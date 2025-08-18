import re
from django.core.exceptions import ValidationError


def validate_hex(value):
    """Проверка что значение является hex-строкой"""
    if not re.match(r'^[0-9a-fA-F]{128}$', value):
        raise ValidationError('Must be a 128-character hex string')
