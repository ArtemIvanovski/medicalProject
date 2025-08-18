import hmac
import hashlib
import json
from django.conf import settings


def generate_data_payload(data):
    clean_data = {k: v for k, v in data.items() if k != 'signature'}

    return json.dumps(clean_data, sort_keys=True).encode('utf-8')


def verify_signature(payload, signature, secret_key):
    """Проверка HMAC подписи"""
    expected_signature = hmac.new(
        bytes.fromhex(secret_key),
        payload,
        hashlib.sha512
    ).digest()

    return hmac.compare_digest(signature, expected_signature)