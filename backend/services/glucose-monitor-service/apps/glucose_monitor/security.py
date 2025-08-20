import os
import hmac
import hashlib
import json
import base64
import time
import logging
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidTag
from django.core.cache import cache
from django.utils import timezone
from django.db import transaction


def generate_hmac_signature(data, key):
    """Генерация HMAC-SHA512 подписи"""
    if isinstance(data, dict):
        canonical_data = json.dumps(data, sort_keys=True).encode('utf-8')
    else:
        canonical_data = data if isinstance(data, bytes) else data.encode('utf-8')

    return hmac.new(
        bytes.fromhex(key),
        canonical_data,
        hashlib.sha512
    ).digest()


def verify_signature(data, signature, key):
    """Проверка HMAC подписи"""
    expected_signature = generate_hmac_signature(data, key)
    # Если signature - это строка base64, декодируем её
    if isinstance(signature, str):
        try:
            signature = base64.b64decode(signature)
        except Exception:
            return False
    return hmac.compare_digest(signature, expected_signature)


def encrypt_payload(payload, key):
    """Шифрование полезной нагрузки (AES-256-GCM)"""
    # Преобразуем полезную нагрузку в байты, если это словарь
    if isinstance(payload, dict):
        payload = json.dumps(payload).encode('utf-8')
    elif isinstance(payload, str):
        payload = payload.encode('utf-8')

    # Генерация случайного nonce (96 бит/12 байт)
    nonce = os.urandom(12)

    # Создание шифра AES-GCM
    cipher = Cipher(
        algorithms.AES(bytes.fromhex(key)),
        modes.GCM(nonce),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()

    # Шифрование данных
    ciphertext = encryptor.update(payload) + encryptor.finalize()

    # Получение тега аутентификации
    tag = encryptor.tag

    # Формат: nonce (12) + ciphertext + tag (16)
    return nonce + ciphertext + tag


def decrypt_payload(encrypted, key):
    """Дешифрование полезной нагрузки (AES-256-GCM)"""
    # Разбор компонентов
    if len(encrypted) < 28:  # 12 nonce + 16 tag
        raise ValueError("Invalid encrypted data length")

    nonce = encrypted[:12]
    tag = encrypted[-16:]
    ciphertext = encrypted[12:-16]

    # Создание шифра AES-GCM
    cipher = Cipher(
        algorithms.AES(bytes.fromhex(key)),
        modes.GCM(nonce, tag),
        backend=default_backend()
    )
    decryptor = cipher.decryptor()

    try:
        # Дешифрование данных
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        return plaintext
    except InvalidTag:
        raise ValueError("Authentication tag verification failed")


@transaction.atomic
def check_nonce_advanced(sensor, nonce, timestamp=None):
    """
    Продвинутая проверка nonce с поддержкой окон и восстановления связи
    
    Args:
        sensor: Объект сенсора
        nonce: Значение nonce для проверки
        timestamp: Временная метка запроса (опционально)
        
    Returns:
        tuple: (bool, str) - (успех, сообщение об ошибке)
    """
    logger = logging.getLogger(__name__)
    
    # Импортируем модель здесь, чтобы избежать циклических импортов
    from .models import SensorNonceTracking
    
    logger.debug(f"Advanced nonce check for {sensor.serial_number}: nonce={nonce}, "
                f"window_start={sensor.nonce_window_start}, window_size={sensor.nonce_window_size}")
    
    current_time = timezone.now()
    current_timestamp = int(time.time())
    
    # 1. Проверка временной метки (если предоставлена)
    if timestamp:
        time_diff = abs(current_timestamp - timestamp)
        max_time_drift = 300  # 5 минут максимальное отклонение
        
        if time_diff > max_time_drift:
            logger.warning(f"Timestamp too far from current time: {time_diff}s > {max_time_drift}s")
            return False, f"Timestamp out of acceptable range: {time_diff}s"
    
    # 2. Определяем текущее окно nonce
    window_start = sensor.nonce_window_start
    window_end = window_start + sensor.nonce_window_size
    
    # 3. Проверяем, находится ли nonce в текущем окне
    if window_start <= nonce < window_end:
        # Nonce в текущем окне - проверяем, не использовался ли уже
        if SensorNonceTracking.objects.filter(sensor=sensor, nonce_value=nonce).exists():
            logger.warning(f"Nonce {nonce} already used in current window")
            return False, "Nonce already used"
            
        # Сохраняем nonce как использованный
        expires_at = current_time + timezone.timedelta(minutes=10)
        SensorNonceTracking.objects.create(
            sensor=sensor,
            nonce_value=nonce,
            expires_at=expires_at
        )
        
        logger.debug(f"Nonce {nonce} accepted in current window")
        return True, "OK"
    
    # 4. Nonce вне текущего окна - возможно, нужна синхронизация
    elif nonce >= window_end:
        # Nonce больше текущего окна - сдвигаем окно
        new_window_start = ((nonce // sensor.nonce_window_size) * sensor.nonce_window_size)
        
        logger.info(f"Moving nonce window for {sensor.serial_number}: "
                   f"{window_start} -> {new_window_start}")
        
        # Очищаем старые nonce из предыдущего окна
        SensorNonceTracking.objects.filter(
            sensor=sensor,
            nonce_value__lt=new_window_start
        ).delete()
        
        # Обновляем окно
        sensor.nonce_window_start = new_window_start
        sensor.sync_status = 'synchronized'
        sensor.save()
        
        # Сохраняем новый nonce
        expires_at = current_time + timezone.timedelta(minutes=10)
        SensorNonceTracking.objects.create(
            sensor=sensor,
            nonce_value=nonce,
            expires_at=expires_at
        )
        
        logger.debug(f"Nonce {nonce} accepted with window shift")
        return True, "OK"
    
    else:
        # Nonce меньше текущего окна - возможная replay-атака
        logger.warning(f"Nonce {nonce} is below current window {window_start}")
        return False, "Nonce too old"


def check_nonce(sensor, nonce):
    """Обратная совместимость со старым API"""
    success, message = check_nonce_advanced(sensor, nonce)
    return success


def sync_sensor_time(sensor, device_timestamp):
    """
    Синхронизация времени с устройством
    
    Args:
        sensor: Объект сенсора
        device_timestamp: Временная метка с устройства
        
    Returns:
        dict: Информация о синхронизации
    """
    logger = logging.getLogger(__name__)
    
    current_timestamp = int(time.time())
    offset = device_timestamp - current_timestamp
    
    logger.info(f"Time sync for {sensor.serial_number}: "
               f"device={device_timestamp}, server={current_timestamp}, offset={offset}")
    
    sensor.last_sync_timestamp = current_timestamp
    sensor.device_clock_offset = offset
    sensor.sync_status = 'synchronized'
    sensor.save()
    
    return {
        'server_time': current_timestamp,
        'device_time': device_timestamp,
        'offset_seconds': offset,
        'status': 'synchronized'
    }


def encrypt_batch_data(measurements_list, key):
    """
    Шифрование списка измерений для batch-отправки
    
    Args:
        measurements_list: Список измерений в формате [{'value': float, 'timestamp': int}, ...]
        key: Hex-строка ключа шифрования
        
    Returns:
        str: Base64-закодированные зашифрованные данные
    """
    # Добавляем случайную соль к данным для дополнительной безопасности
    salt = base64.b64encode(os.urandom(16)).decode('utf-8')
    data_with_salt = {
        'salt': salt,
        'measurements': measurements_list,
        'count': len(measurements_list)
    }
    
    encrypted = encrypt_payload(data_with_salt, key)
    return base64.b64encode(encrypted).decode('utf-8')


def decrypt_batch_data(encrypted_data_b64, key):
    """
    Дешифрование списка измерений из batch-отправки
    
    Args:
        encrypted_data_b64: Base64-закодированные зашифрованные данные
        key: Hex-строка ключа шифрования
        
    Returns:
        list: Список измерений
    """
    encrypted_data = base64.b64decode(encrypted_data_b64)
    decrypted = decrypt_payload(encrypted_data, key)
    data = json.loads(decrypted.decode('utf-8'))
    
    # Проверяем структуру данных
    if 'measurements' not in data or 'count' not in data:
        raise ValueError("Invalid batch data structure")
    
    if len(data['measurements']) != data['count']:
        raise ValueError("Measurement count mismatch")
    
    return data['measurements']


def generate_device_signature(device_data, secret_key, device_id):
    """
    Генерация подписи устройства с дополнительными параметрами безопасности
    
    Args:
        device_data: Данные для подписи
        secret_key: Секретный ключ устройства
        device_id: Уникальный идентификатор устройства
        
    Returns:
        str: Base64-закодированная подпись
    """
    # Добавляем device_id к данным для подписи
    extended_data = {
        'device_id': device_id,
        'data': device_data,
        'timestamp': int(time.time())
    }
    
    signature = generate_hmac_signature(extended_data, secret_key)
    return base64.b64encode(signature).decode('utf-8')


def verify_device_signature(device_data, signature_b64, secret_key, device_id, max_age_seconds=300):
    """
    Проверка подписи устройства с проверкой времени
    
    Args:
        device_data: Данные для проверки
        signature_b64: Base64-закодированная подпись
        secret_key: Секретный ключ устройства
        device_id: Уникальный идентификатор устройства
        max_age_seconds: Максимальный возраст подписи в секундах
        
    Returns:
        bool: Результат проверки
    """
    current_time = int(time.time())
    
    # Проверяем подписи для диапазона времени (защита от небольших отклонений часов)
    for time_offset in range(-max_age_seconds, max_age_seconds + 1, 60):  # Проверяем каждую минуту
        test_timestamp = current_time + time_offset
        
        extended_data = {
            'device_id': device_id,
            'data': device_data,
            'timestamp': test_timestamp
        }
        
        if verify_signature(extended_data, signature_b64, secret_key):
            return True
    
    return False


def cleanup_security_data():
    """
    Очистка устаревших данных безопасности
    Должна вызываться периодически (например, через cron)
    """
    logger = logging.getLogger(__name__)
    
    from .models import SensorNonceTracking, SensorBatchData
    
    # Очищаем истёкшие nonce
    deleted_nonces = SensorNonceTracking.cleanup_expired()[0]
    logger.info(f"Cleaned up {deleted_nonces} expired nonces")
    
    # Очищаем старые обработанные batch-данные (старше 24 часов)
    cleanup_time = timezone.now() - timezone.timedelta(hours=24)
    deleted_batches = SensorBatchData.objects.filter(
        is_processed=True,
        processed_at__lt=cleanup_time
    ).delete()[0]
    logger.info(f"Cleaned up {deleted_batches} old batch records")
    
    return {
        'deleted_nonces': deleted_nonces,
        'deleted_batches': deleted_batches
    }


def create_secure_session_token(sensor_id, secret_key):
    """
    Создание безопасного токена сессии для устройства
    
    Args:
        sensor_id: ID сенсора
        secret_key: Секретный ключ
        
    Returns:
        str: Токен сессии
    """
    session_data = {
        'sensor_id': str(sensor_id),
        'issued_at': int(time.time()),
        'nonce': base64.b64encode(os.urandom(16)).decode('utf-8')
    }
    
    signature = generate_hmac_signature(session_data, secret_key)
    token_data = {
        'session': session_data,
        'signature': base64.b64encode(signature).decode('utf-8')
    }
    
    return base64.b64encode(json.dumps(token_data).encode('utf-8')).decode('utf-8')


def verify_session_token(token_b64, secret_key, max_age_hours=24):
    """
    Проверка токена сессии
    
    Args:
        token_b64: Base64-закодированный токен
        secret_key: Секретный ключ
        max_age_hours: Максимальный возраст токена в часах
        
    Returns:
        dict или None: Данные сессии или None при ошибке
    """
    try:
        token_data = json.loads(base64.b64decode(token_b64).decode('utf-8'))
        session_data = token_data['session']
        signature_b64 = token_data['signature']
        
        # Проверяем подпись
        if not verify_signature(session_data, signature_b64, secret_key):
            return None
        
        # Проверяем возраст токена
        issued_at = session_data['issued_at']
        current_time = int(time.time())
        age_hours = (current_time - issued_at) / 3600
        
        if age_hours > max_age_hours:
            return None
        
        return session_data
        
    except Exception:
        return None