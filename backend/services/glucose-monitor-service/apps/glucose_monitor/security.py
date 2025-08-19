import os
import hmac
import hashlib
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidTag
from django.core.cache import cache


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


def check_nonce(sensor, nonce):
    """Проверка уникальности nonce и защита от replay-атак"""
    cache_key = f"sensor_{sensor.serial_number}_nonce_{nonce}"

    # Если nonce уже использовался - отклоняем
    if cache.get(cache_key):
        return False

    # Сохраняем nonce в кэше на 10 минут
    cache.set(cache_key, True, timeout=600)

    # Дополнительная проверка: nonce должен быть больше предыдущего
    if nonce <= sensor.request_counter:
        return False

    # Обновляем счетчик в сенсоре
    sensor.request_counter = nonce
    sensor.save()

    return True