from rest_framework import serializers


class DrugSearchSerializer(serializers.Serializer):
    query = serializers.CharField(
        max_length=100,
        required=True,
        help_text="Поисковый запрос для лекарств"
    )
