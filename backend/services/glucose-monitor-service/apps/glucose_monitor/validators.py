import re
from django.core.exceptions import ValidationError


def validate_hex_key(value):
    """Проверка что значение является hex-строкой нужной длины"""
    if not re.match(r'^[0-9a-fA-F]{64}$', value):
        raise ValidationError('Must be a 64-character hex string (32 bytes)')
