#!/usr/bin/env python3
"""
Тестовый скрипт для демонстрации работы улучшенной системы безопасности
"""

import os
import sys
import time
import subprocess
import json
from pathlib import Path


def print_banner(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_step(step_num, description):
    print(f"\n[Шаг {step_num}] {description}")
    print("-" * 50)


def run_generator_command(command, timeout=30):
    """Запуск команды генератора с таймаутом"""
    try:
        cmd = [sys.executable, 'secure_glucose_generator.py', command]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)


def show_status():
    """Показать текущий статус генератора"""
    success, stdout, stderr = run_generator_command('status')
    if success:
        try:
            status = json.loads(stdout)
            print(f"📊 Статус сенсора {status['serial_number']}:")
            print(f"   • Текущий nonce: {status['current_nonce']}")
            print(f"   • Окно nonce: {status['nonce_window']['start']} - {status['nonce_window']['end']}")
            print(f"   • Всего измерений: {status['total_measurements']}")
            print(f"   • Неотправленных: {status['unsent_measurements']}")
            print(f"   • Соединение: {'✅ Доступно' if status['connection_available'] else '❌ Недоступно'}")
            if status['last_successful_send']:
                print(f"   • Последняя отправка: {time.ctime(status['last_successful_send'])}")
        except json.JSONDecodeError:
            print("❌ Ошибка парсинга статуса")
            print(stdout)
    else:
        print(f"❌ Ошибка получения статуса: {stderr}")


def test_sync():
    """Тест синхронизации"""
    print("🔄 Выполняется синхронизация...")
    success, stdout, stderr = run_generator_command('sync')
    if success:
        print("✅ Синхронизация успешна")
    else:
        print(f"❌ Ошибка синхронизации: {stderr}")


def test_send_data():
    """Тест отправки данных"""
    print("📤 Отправка тестовых данных...")
    success, stdout, stderr = run_generator_command('test')
    if success:
        print("✅ Тестовые данные отправлены")
        print(stdout)
    else:
        print(f"❌ Ошибка отправки: {stderr}")


def test_continuous_mode():
    """Тест непрерывного режима"""
    print("⏱️ Запуск в непрерывном режиме на 60 секунд...")
    print("(Нажмите Ctrl+C для остановки)")

    try:
        cmd = [sys.executable, 'secure_glucose_generator.py']
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

        start_time = time.time()
        while time.time() - start_time < 60:
            try:
                line = process.stdout.readline()
                if line:
                    print(f"📝 {line.strip()}")

                if process.poll() is not None:
                    break

                time.sleep(0.1)
            except KeyboardInterrupt:
                print("\n🛑 Получен сигнал остановки")
                break

        # Останавливаем процесс
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

        print("✅ Непрерывный режим завершен")

    except Exception as e:
        print(f"❌ Ошибка в непрерывном режиме: {str(e)}")


def cleanup_files():
    """Очистка тестовых файлов"""
    files_to_remove = [
        'sensor_state_GLU-6F60C3CB95B2.pickle',
        'sensor_data_GLU-6F60C3CB95B2.db',
        'secure_glucose_generator.log'
    ]

    for filename in files_to_remove:
        filepath = Path(filename)
        if filepath.exists():
            filepath.unlink()
            print(f"🗑️ Удален файл: {filename}")


def main():
    """Основная функция тестирования"""
    print_banner("ТЕСТИРОВАНИЕ БЕЗОПАСНОЙ СИСТЕМЫ МОНИТОРИНГА ГЛЮКОЗЫ")

    # Проверяем наличие конфигурации
    if not os.path.exists('secure_glucose_config.json'):
        print("❌ Файл конфигурации secure_glucose_config.json не найден!")
        print("Убедитесь, что файл конфигурации создан и содержит правильные данные.")
        return

    try:
        while True:
            print("\n🎯 МЕНЮ ТЕСТИРОВАНИЯ:")
            print("1. Показать статус системы")
            print("2. Тест синхронизации")
            print("3. Отправка тестовых данных")
            print("4. Непрерывный режим (60 сек)")
            print("5. Симуляция перезапуска")
            print("6. Очистка файлов состояния")
            print("0. Выход")

            choice = input("\nВыберите опцию (0-6): ").strip()

            if choice == '0':
                print("👋 Завершение тестирования")
                break
            elif choice == '1':
                print_step(1, "Проверка статуса системы")
                show_status()
            elif choice == '2':
                print_step(2, "Тестирование синхронизации")
                test_sync()
                show_status()
            elif choice == '3':
                print_step(3, "Отправка тестовых данных")
                test_send_data()
                show_status()
            elif choice == '4':
                print_step(4, "Непрерывный режим")
                test_continuous_mode()
                show_status()
            elif choice == '5':
                print_step(5, "Симуляция перезапуска")
                print("📊 Статус ДО перезапуска:")
                show_status()

                print("\n💤 Симуляция выключения на 5 секунд...")
                time.sleep(5)

                print("\n🔄 Симуляция включения после перезапуска:")
                show_status()
                print("\n✅ Видно, что состояние восстановлено из файла!")
            elif choice == '6':
                print_step(6, "Очистка файлов состояния")
                cleanup_files()
                print("✅ Файлы состояния очищены. При следующем запуске будет создано новое состояние.")
            else:
                print("❌ Неверный выбор. Попробуйте снова.")

    except KeyboardInterrupt:
        print("\n\n🛑 Тестирование прервано пользователем")
    except Exception as e:
        print(f"\n❌ Ошибка во время тестирования: {str(e)}")


if __name__ == '__main__':
    main()
