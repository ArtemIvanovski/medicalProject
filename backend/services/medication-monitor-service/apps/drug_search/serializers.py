from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from .models import Drug, MedicationIntake, FavoriteDrug, MedicationPatternItem, MedicationPattern, MedicationReminder


class DrugSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drug
        fields = ['id', 'name', 'form', 'description']


class MedicationIntakeSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source='drug.name', read_only=True)
    drug_form = serializers.CharField(source='drug.form', read_only=True)

    class Meta:
        model = MedicationIntake
        fields = [
            'id', 'drug', 'drug_name', 'drug_form',
            'taken_at', 'amount', 'unit', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreateMedicationIntakeSerializer(serializers.Serializer):
    drug_name = serializers.CharField(max_length=255)
    drug_form = serializers.CharField(max_length=100)
    taken_at = serializers.DateTimeField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    unit = serializers.ChoiceField(choices=MedicationIntake.UNIT_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_taken_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError("Время приема не может быть в будущем")

        one_day_ago = timezone.now() - timezone.timedelta(days=1)
        if value < one_day_ago:
            raise serializers.ValidationError("Можно добавлять записи только за последние 24 часа")

        return value


class MedicationStatsSerializer(serializers.Serializer):
    drug_id = serializers.UUIDField()
    drug_name = serializers.CharField()
    drug_form = serializers.CharField()
    total_intakes = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    avg_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    last_taken = serializers.DateTimeField()


class DrugSearchSerializer(serializers.Serializer):
    query = serializers.CharField(
        max_length=100,
        required=True,
        help_text="Поисковый запрос для лекарств"
    )


class FavoriteDrugSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source='drug.name', read_only=True)
    drug_form = serializers.CharField(source='drug.form', read_only=True)

    class Meta:
        model = FavoriteDrug
        fields = ['id', 'drug', 'drug_name', 'drug_form', 'created_at']
        read_only_fields = ['id', 'created_at']


class MedicationPatternItemSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source='drug.name', read_only=True)
    drug_form = serializers.CharField(source='drug.form', read_only=True)

    class Meta:
        model = MedicationPatternItem
        fields = [
            'id', 'drug', 'drug_name', 'drug_form',
            'amount', 'unit', 'notes', 'order'
        ]


class MedicationPatternSerializer(serializers.ModelSerializer):
    items = MedicationPatternItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = MedicationPattern
        fields = [
            'id', 'name', 'description', 'is_active',
            'items', 'items_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()


class CreateMedicationPatternSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )

    def validate_items(self, value):
        for item in value:
            if not all(key in item for key in ['drug_name', 'drug_form', 'amount', 'unit']):
                raise serializers.ValidationError(
                    "Каждый элемент должен содержать: drug_name, drug_form, amount, unit"
                )
        return value


class MedicationReminderSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source='drug.name', read_only=True)
    drug_form = serializers.CharField(source='drug.form', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)

    class Meta:
        model = MedicationReminder
        fields = [
            'id', 'drug', 'drug_name', 'drug_form', 'title',
            'amount', 'unit', 'frequency', 'frequency_display',
            'time', 'weekdays', 'start_date', 'end_date',
            'is_active', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreateMedicationReminderSerializer(serializers.Serializer):
    drug_name = serializers.CharField(max_length=255)
    drug_form = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    unit = serializers.ChoiceField(choices=MedicationIntake.UNIT_CHOICES)
    frequency = serializers.ChoiceField(choices=MedicationReminder.FREQUENCY_CHOICES)
    time = serializers.TimeField()
    weekdays = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['frequency'] == 'custom' and not data.get('weekdays'):
            raise serializers.ValidationError(
                "Для частоты 'По дням недели' необходимо указать дни недели"
            )

        if data.get('end_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError(
                "Дата окончания не может быть раньше даты начала"
            )

        return data


class ApplyPatternSerializer(serializers.Serializer):
    pattern_id = serializers.UUIDField()
    taken_at = serializers.DateTimeField()

    def validate_taken_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError("Время приема не может быть в будущем")
        return value
