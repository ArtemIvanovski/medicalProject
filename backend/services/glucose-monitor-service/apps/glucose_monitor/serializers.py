import base64
import time

from rest_framework import serializers

from .models import GlucoseData, Sensor, SensorSettings


class SensorRegistrationSerializer(serializers.Serializer):
    serial_number = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Уникальный серийный номер устройства"
    )
    name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Человеко-читаемое имя сенсора"
    )


class SensorAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = ['id', 'serial_number', 'name', 'is_active', 'user', 'created_at', 'updated_at', 'claim_token']
        read_only_fields = ['id', 'created_at', 'updated_at', 'claim_token']


class SensorSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorSettings
        fields = [
            'battery_level', 'low_glucose_threshold', 'high_glucose_threshold',
            'polling_interval_minutes', 'activation_time', 'expiration_time'
        ]


class BaseSensorSerializer(serializers.Serializer):
    signature = serializers.CharField(max_length=88)
    nonce = serializers.IntegerField(min_value=1)
    timestamp = serializers.IntegerField()
    sequence_id = serializers.IntegerField(min_value=0)

    def validate_signature(self, value):
        try:
            return base64.b64decode(value)
        except:
            raise serializers.ValidationError("Invalid base64 encoding")

    def validate_timestamp(self, value):
        current_time = int(time.time())
        if abs(current_time - value) > 300:  # 5 минут окно
            raise serializers.ValidationError("Timestamp outside allowed window")
        return value


class SingleDataSerializer(BaseSensorSerializer):
    value = serializers.FloatField(
        min_value=0.1,
        max_value=33.3
    )


class BatchDataSerializer(serializers.Serializer):
    signature = serializers.CharField(max_length=88)
    nonce = serializers.IntegerField(min_value=1)
    timestamp = serializers.IntegerField()
    encrypted_data = serializers.CharField()

    def validate_signature(self, value):
        try:
            return base64.b64decode(value)
        except:
            raise serializers.ValidationError("Invalid base64 encoding")

    def validate_timestamp(self, value):
        current_time = int(time.time())
        if abs(current_time - value) > 300:  # 5 минут окно
            raise serializers.ValidationError("Timestamp outside allowed window")
        return value

    def validate(self, attrs):
        # Дешифровка данных будет происходить в представлении после аутентификации
        return attrs


class GlucoseDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlucoseData
        fields = ['value', 'timestamp', 'sequence_id']


class MeasurementItemSerializer(serializers.Serializer):
    value = serializers.FloatField(min_value=0.1, max_value=33.3)
    timestamp = serializers.IntegerField()
    sequence_id = serializers.IntegerField(min_value=0)
