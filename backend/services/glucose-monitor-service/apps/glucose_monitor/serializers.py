import base64

from rest_framework import serializers


class BaseSensorSerializer(serializers.Serializer):
    signature = serializers.CharField(max_length=88)
    nonce = serializers.IntegerField(min_value=1)
    timestamp = serializers.DateTimeField()

    def validate_signature(self, value):
        try:
            return base64.b64decode(value)
        except:
            raise serializers.ValidationError("Invalid base64 encoding")


class SingleDataSerializer(BaseSensorSerializer):
    value = serializers.FloatField()
    sequence_id = serializers.IntegerField(min_value=0)


class BatchDataSerializer(BaseSensorSerializer):
    data = serializers.ListField(
        child=serializers.DictField(
            child={
                'value': serializers.FloatField(),
                'timestamp': serializers.DateTimeField(),
                'sequence_id': serializers.IntegerField(min_value=0)
            }
        ),
        min_length=1,
        max_length=1000
    )

    def validate_data(self, value):
        sequence_ids = [item['sequence_id'] for item in value]
        if len(sequence_ids) != len(set(sequence_ids)):
            raise serializers.ValidationError("Duplicate sequence_id in batch")
        return value
