import base64
import hashlib
import hmac
import json
import logging
import os
import pickle
import random
import sys
import time
from typing import Dict, Any, List, Optional
import sqlite3
from datetime import datetime, timedelta

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('secure_glucose_generator.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class SecureGlucoseDataGenerator:
    """
    Безопасный генератор данных глюкозы с поддержкой:
    - Окон nonce для защиты от replay-атак
    - Восстановления связи после перезапуска
    - Накопления данных при отсутствии интернета
    - Batch-отправки данных
    - Синхронизации времени
    """
    
    def __init__(self, config_file: str = 'secure_glucose_config.json'):
        self.config = self.load_config(config_file)
        self.state_file = f"sensor_state_{self.config['serial_number']}.pickle"
        self.db_file = f"sensor_data_{self.config['serial_number']}.db"
        
        # Загружаем сохраненное состояние или инициализируем новое
        self.state = self.load_state()
        
        # Инициализируем локальную БД для накопления данных
        self.init_local_db()
        
        # Настройки HTTP
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SecureGlucoseSensor/2.0'
        })
        
        # Флаг состояния соединения
        self.connection_available = True
        self.last_sync_attempt = 0
        
        logger.info(f"Secure генератор инициализирован для сенсора {self.config['serial_number']}")
        logger.info(f"Текущий nonce: {self.state['current_nonce']}")
        logger.info(f"Nonce window: {self.state['nonce_window_start']} - {self.state['nonce_window_start'] + self.state['nonce_window_size']}")
        
        # Принудительная синхронизация при запуске для обеспечения корректного состояния
        if self.check_connection():
            logger.info("Выполняется синхронизация при запуске...")
            if self.sync_with_server():
                logger.info("✅ Начальная синхронизация успешна")
            else:
                logger.warning("⚠️ Начальная синхронизация не удалась, но продолжаем работу")

    def load_config(self, config_file: str) -> Dict[str, Any]:
        """Загрузка конфигурации из файла"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)

            required_fields = ['serial_number', 'secret_key', 'api_base_url']
            for field in required_fields:
                if field not in config:
                    raise ValueError(f"Отсутствует обязательное поле: {field}")

            return config

        except FileNotFoundError:
            logger.error(f"Файл конфигурации {config_file} не найден")
            self.create_sample_config(config_file)
            raise
        except json.JSONDecodeError:
            logger.error(f"Ошибка в формате JSON файла {config_file}")
            raise

    def create_sample_config(self, config_file: str):
        """Создание примера файла конфигурации"""
        sample_config = {
            "serial_number": "GLU-6F60C3CB95B2",
            "secret_key": "98a5dde831be401a03b7012452ed8c4cf600dbafcd1069085496e25b051cb4cc",
            "api_base_url": "http://localhost:8006/api/v1",
            "glucose_range": {
                "min": 3.0,
                "max": 15.0
            },
            "send_interval_minutes": 10,
            "normal_range": {
                "min": 4.0,
                "max": 7.0,
                "probability": 0.7
            },
            "batch_size": 5,
            "max_offline_hours": 24,
            "sync_interval_minutes": 30
        }

        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(sample_config, f, indent=2, ensure_ascii=False)

        logger.info(f"Создан пример файла конфигурации: {config_file}")

    def load_state(self) -> Dict[str, Any]:
        """Загрузка сохраненного состояния сенсора"""
        try:
            with open(self.state_file, 'rb') as f:
                state = pickle.load(f)
                logger.info("Состояние сенсора восстановлено из файла")
                return state
        except FileNotFoundError:
            logger.info("Создание нового состояния сенсора")
            return {
                'current_nonce': 1000,  # Начинаем с 1000
                'nonce_window_start': 1000,
                'nonce_window_size': 1000,
                'last_sync_timestamp': int(time.time()),
                'device_clock_offset': 0,
                'total_measurements': 0,
                'last_successful_send': None
            }

    def save_state(self):
        """Сохранение текущего состояния сенсора"""
        with open(self.state_file, 'wb') as f:
            pickle.dump(self.state, f)

    def init_local_db(self):
        """Инициализация локальной БД для накопления данных"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                sent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()

    def get_next_nonce(self) -> int:
        """Получение следующего nonce"""
        current_nonce = self.state['current_nonce']
        window_start = self.state['nonce_window_start']
        window_size = self.state['nonce_window_size']
        window_end = window_start + window_size
        
        # Если nonce выходит за пределы окна, переходим к следующему окну
        if current_nonce >= window_end:
            new_window_start = window_end
            self.state['nonce_window_start'] = new_window_start
            logger.info(f"Переход к новому окну nonce: {new_window_start}")
        
        self.state['current_nonce'] += 1
        self.save_state()
        return self.state['current_nonce']

    def generate_hmac_signature(self, data: Dict[str, Any]) -> str:
        """Генерация HMAC-SHA512 подписи для данных"""
        canonical_data = json.dumps(data, sort_keys=True).encode('utf-8')
        signature = hmac.new(
            bytes.fromhex(self.config['secret_key']),
            canonical_data,
            hashlib.sha512
        ).digest()
        return base64.b64encode(signature).decode('utf-8')

    def encrypt_batch_data(self, measurements_list: List[Dict]) -> str:
        """Шифрование списка измерений для batch-отправки"""
        # Добавляем соль для дополнительной безопасности
        salt = base64.b64encode(os.urandom(16)).decode('utf-8')
        data_with_salt = {
            'salt': salt,
            'measurements': measurements_list,
            'count': len(measurements_list)
        }
        
        # Преобразуем в JSON
        payload = json.dumps(data_with_salt).encode('utf-8')
        
        # Генерация случайного nonce (96 бит/12 байт)
        nonce = os.urandom(12)
        
        # Создание шифра AES-GCM
        cipher = Cipher(
            algorithms.AES(bytes.fromhex(self.config['secret_key'])),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Шифрование данных
        ciphertext = encryptor.update(payload) + encryptor.finalize()
        tag = encryptor.tag
        
        # Формат: nonce (12) + ciphertext + tag (16)
        encrypted = nonce + ciphertext + tag
        return base64.b64encode(encrypted).decode('utf-8')

    def generate_glucose_value(self) -> float:
        """Генерация случайного значения глюкозы"""
        glucose_range = self.config.get('glucose_range', {'min': 3.0, 'max': 15.0})
        normal_range = self.config.get('normal_range', {
            'min': 4.0, 'max': 7.0, 'probability': 0.7
        })

        if random.random() < normal_range['probability']:
            value = random.uniform(normal_range['min'], normal_range['max'])
        else:
            if random.random() < 0.5:
                value = random.uniform(glucose_range['min'], normal_range['min'])
            else:
                value = random.uniform(normal_range['max'], glucose_range['max'])

        return round(value, 1)

    def store_measurement_locally(self, value: float, timestamp: int):
        """Сохранение измерения в локальной БД"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO measurements (value, timestamp) VALUES (?, ?)
        ''', (value, timestamp))
        
        conn.commit()
        conn.close()
        
        self.state['total_measurements'] += 1
        self.save_state()

    def get_unsent_measurements(self, limit: Optional[int] = None) -> List[Dict]:
        """Получение неотправленных измерений"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        query = '''
            SELECT id, value, timestamp FROM measurements 
            WHERE sent = FALSE 
            ORDER BY timestamp ASC
        '''
        
        if limit:
            query += f' LIMIT {limit}'
        
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'value': row[1],
                'timestamp': row[2]
            }
            for row in rows
        ]

    def mark_measurements_sent(self, measurement_ids: List[int]):
        """Отметка измерений как отправленных"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        placeholders = ','.join(['?' for _ in measurement_ids])
        cursor.execute(f'''
            UPDATE measurements 
            SET sent = TRUE 
            WHERE id IN ({placeholders})
        ''', measurement_ids)
        
        conn.commit()
        conn.close()

    def sync_with_server(self) -> bool:
        """Синхронизация времени и nonce с сервером"""
        current_timestamp = int(time.time())
        
        # Для синхронизации используем nonce из следующего окна
        next_window_start = self.state['nonce_window_start'] + self.state['nonce_window_size']
        sync_nonce = next_window_start + 1
        
        payload = {
            'nonce': sync_nonce,
            'timestamp': current_timestamp,
            'device_timestamp': current_timestamp + self.state['device_clock_offset'],
            'request_new_window': True
        }
        
        sign_data = {
            'path': f"/api/v1/sensor/{self.config['serial_number']}/sync/",
            'nonce': sync_nonce,
            'timestamp': current_timestamp,
            'body': payload
        }
        
        signature = self.generate_hmac_signature(sign_data)
        payload['signature'] = signature
        
        url = f"{self.config['api_base_url']}/sensor/{self.config['serial_number']}/sync/"
        
        try:
            logger.info(f"Синхронизация с сервером (nonce: {sync_nonce})...")
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                sync_info = response.json()
                
                # Обновляем локальное состояние
                if 'nonce_window' in sync_info:
                    new_window_start = sync_info['nonce_window']['start']
                    new_window_size = sync_info['nonce_window']['size']
                    
                    self.state['nonce_window_start'] = new_window_start
                    self.state['nonce_window_size'] = new_window_size
                    # Устанавливаем текущий nonce в начало нового окна
                    self.state['current_nonce'] = new_window_start
                    
                    logger.info(f"Новое окно nonce: {new_window_start} - {new_window_start + new_window_size}")
                
                if 'sync_info' in sync_info:
                    self.state['device_clock_offset'] = sync_info['sync_info']['offset_seconds']
                    logger.info(f"Смещение времени обновлено: {self.state['device_clock_offset']} сек")
                
                self.state['last_sync_timestamp'] = current_timestamp
                self.save_state()
                
                logger.info("✅ Синхронизация успешна")
                return True
            else:
                logger.error(f"❌ Ошибка синхронизации: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка при синхронизации: {str(e)}")
            return False

    def send_single_measurement(self, value: float) -> bool:
        """Отправка одного измерения"""
        current_timestamp = int(time.time())
        nonce = self.get_next_nonce()
        
        payload = {
            'value': value,
            'sequence_id': nonce,  # Для совместимости
            'timestamp': current_timestamp,
            'nonce': nonce
        }
        
        sign_data = {
            'path': f"/api/v1/sensor/{self.config['serial_number']}/single/",
            'nonce': nonce,
            'timestamp': current_timestamp,
            'body': payload
        }
        
        signature = self.generate_hmac_signature(sign_data)
        payload['signature'] = signature
        
        url = f"{self.config['api_base_url']}/sensor/{self.config['serial_number']}/single/"
        
        try:
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 201:
                logger.info(f"[SUCCESS] Измерение отправлено: {value} mmol/L")
                self.state['last_successful_send'] = current_timestamp
                self.save_state()
                return True
            else:
                logger.error(f"[ERROR] Ошибка отправки: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"[NETWORK] Ошибка сети: {str(e)}")
            return False

    def send_batch_measurements(self, measurements: List[Dict], retry_count: int = 0) -> bool:
        """Отправка пакета измерений с автоматической пересинхронизацией при ошибках nonce"""
        if not measurements:
            return True
        
        max_retries = 2
        if retry_count >= max_retries:
            logger.error(f"Превышено максимальное количество попыток отправки ({max_retries})")
            return False
            
        current_timestamp = int(time.time())
        nonce = self.get_next_nonce()
        
        # Подготавливаем данные для шифрования
        measurement_data = [
            {
                'value': m['value'],
                'timestamp': m['timestamp']
            }
            for m in measurements
        ]
        
        encrypted_data = self.encrypt_batch_data(measurement_data)
        
        payload = {
            'nonce': nonce,
            'timestamp': current_timestamp,
            'encrypted_data': encrypted_data,
            'is_final': True
        }
        
        sign_data = {
            'path': f"/api/v1/sensor/{self.config['serial_number']}/batch/",
            'nonce': nonce,
            'timestamp': current_timestamp,
            'body': payload
        }
        
        signature = self.generate_hmac_signature(sign_data)
        payload['signature'] = signature
        
        url = f"{self.config['api_base_url']}/sensor/{self.config['serial_number']}/batch/"
        
        try:
            retry_text = f" (попытка {retry_count + 1})" if retry_count > 0 else ""
            logger.info(f"Отправка batch из {len(measurements)} измерений{retry_text}...")
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 201:
                result = response.json()
                logger.info(f"[SUCCESS] Batch отправлен: {result.get('saved', 0)}/{result.get('total', 0)} измерений")
                
                # Отмечаем измерения как отправленные
                measurement_ids = [m['id'] for m in measurements]
                self.mark_measurements_sent(measurement_ids)
                
                self.state['last_successful_send'] = current_timestamp
                self.save_state()
                return True
                
            elif response.status_code == 401:
                # Ошибка аутентификации - возможно проблема с nonce
                error_text = response.text
                if "nonce" in error_text.lower():
                    logger.warning(f"[NONCE_ERROR] Проблема с nonce, попытка пересинхронизации...")
                    
                    # Принудительная синхронизация
                    if self.sync_with_server():
                        logger.info("Пересинхронизация успешна, повторная попытка отправки...")
                        # Рекурсивный вызов с увеличенным счетчиком
                        return self.send_batch_measurements(measurements, retry_count + 1)
                    else:
                        logger.error("Пересинхронизация не удалась")
                        return False
                else:
                    logger.error(f"[AUTH_ERROR] Ошибка аутентификации: {error_text}")
                    return False
            else:
                logger.error(f"[ERROR] Ошибка отправки batch: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"[NETWORK] Ошибка сети при отправке batch: {str(e)}")
            return False

    def check_connection(self) -> bool:
        """Проверка доступности соединения"""
        try:
            url = f"{self.config['api_base_url']}/sensor/{self.config['serial_number']}/status/"
            response = self.session.get(url, timeout=10)
            return response.status_code in [200, 401, 403]  # Любой валидный ответ от сервера
        except Exception:
            return False

    def try_send_accumulated_data(self):
        """Попытка отправки накопленных данных"""
        if not self.check_connection():
            logger.info("Нет соединения с сервером")
            self.connection_available = False
            return

        self.connection_available = True
        
        # Проверяем, нужна ли синхронизация
        current_time = int(time.time())
        sync_interval = self.config.get('sync_interval_minutes', 30) * 60
        
        if (current_time - self.state['last_sync_timestamp']) > sync_interval:
            if self.sync_with_server():
                logger.info("Синхронизация завершена")
            else:
                logger.warning("Синхронизация не удалась")
        
        # Отправляем накопленные данные
        batch_size = self.config.get('batch_size', 5)
        unsent = self.get_unsent_measurements(limit=batch_size)
        
        if unsent:
            logger.info(f"Найдено {len(unsent)} неотправленных измерений")
            if self.send_batch_measurements(unsent):
                logger.info("Накопленные данные отправлены")
            else:
                logger.warning("Не удалось отправить накопленные данные")

    def run_measurement_cycle(self):
        """Один цикл измерения и отправки"""
        # Генерируем измерение
        glucose_value = self.generate_glucose_value()
        current_timestamp = int(time.time())
        
        # Сохраняем локально
        self.store_measurement_locally(glucose_value, current_timestamp)
        logger.info(f"Измерение: {glucose_value} mmol/L (сохранено локально)")
        
        # Пытаемся отправить данные
        self.try_send_accumulated_data()

    def run_continuous(self):
        """Непрерывная работа генератора"""
        interval_minutes = self.config.get('send_interval_minutes', 10)
        interval_seconds = interval_minutes * 60
        
        logger.info(f"[START] Запуск безопасного генератора данных глюкозы")
        logger.info(f"[CONFIG] Интервал измерений: {interval_minutes} минут")
        logger.info(f"[SENSOR] Сенсор: {self.config['serial_number']}")
        logger.info(f"[API] API: {self.config['api_base_url']}")
        
        consecutive_failures = 0
        max_failures = 10
        
        try:
            while True:
                try:
                    self.run_measurement_cycle()
                    consecutive_failures = 0
                except Exception as e:
                    logger.error(f"Ошибка в цикле измерения: {str(e)}")
                    consecutive_failures += 1
                    
                    if consecutive_failures >= max_failures:
                        logger.error(f"Слишком много ошибок подряд ({max_failures}). Остановка.")
                        break
                
                # Ждем следующий цикл
                logger.info(f"[WAIT] Ожидание {interval_minutes} минут до следующего измерения...")
                time.sleep(interval_seconds)
                
        except KeyboardInterrupt:
            logger.info("Получен сигнал остановки")
        except Exception as e:
            logger.error(f"Критическая ошибка: {str(e)}")
        finally:
            self.save_state()
            logger.info("Состояние сохранено")

    def send_test_data(self):
        """Отправка тестовых данных"""
        logger.info("[TEST] Отправка тестовых данных...")
        
        # Синхронизация перед тестом
        if self.sync_with_server():
            logger.info("Синхронизация перед тестом успешна")
        else:
            logger.warning("Синхронизация перед тестом не удалась")
        
        test_values = [4.5, 6.2, 8.1, 3.8, 12.5]
        
        for value in test_values:
            current_timestamp = int(time.time())
            self.store_measurement_locally(value, current_timestamp)
            logger.info(f"Тестовое измерение сохранено: {value} mmol/L")
            time.sleep(1)
        
        # Отправляем все тестовые данные
        self.try_send_accumulated_data()

    def get_status(self) -> Dict[str, Any]:
        """Получение статуса генератора"""
        unsent_count = len(self.get_unsent_measurements())
        
        return {
            'serial_number': self.config['serial_number'],
            'current_nonce': self.state['current_nonce'],
            'nonce_window': {
                'start': self.state['nonce_window_start'],
                'size': self.state['nonce_window_size'],
                'end': self.state['nonce_window_start'] + self.state['nonce_window_size']
            },
            'total_measurements': self.state['total_measurements'],
            'unsent_measurements': unsent_count,
            'last_successful_send': self.state['last_successful_send'],
            'last_sync_timestamp': self.state['last_sync_timestamp'],
            'connection_available': self.connection_available
        }


def main():
    """Основная функция"""
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'test':
            # Режим тестирования
            generator = SecureGlucoseDataGenerator()
            generator.send_test_data()
        elif command == 'status':
            # Показать статус
            generator = SecureGlucoseDataGenerator()
            status = generator.get_status()
            print(json.dumps(status, indent=2, default=str))
        elif command == 'sync':
            # Принудительная синхронизация
            generator = SecureGlucoseDataGenerator()
            if generator.sync_with_server():
                print("Синхронизация успешна")
            else:
                print("Синхронизация не удалась")
        elif command == 'send':
            # Отправить накопленные данные
            generator = SecureGlucoseDataGenerator()
            generator.try_send_accumulated_data()
        else:
            print("Доступные команды: test, status, sync, send")
    else:
        # Обычный режим работы
        generator = SecureGlucoseDataGenerator()
        generator.run_continuous()


if __name__ == '__main__':
    main()
