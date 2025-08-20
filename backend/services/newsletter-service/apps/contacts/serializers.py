from rest_framework import serializers
from .models import Contact

class ContactCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['name', 'email', 'phone', 'subject', 'message']
        
    def validate_email(self, value):
        return value.lower().strip()
        
    def validate_phone(self, value):
        import re
        phone = re.sub(r'[\s\-\(\)]', '', value)
        if not re.match(r'^(\+375|375)?(29|33|44|25)\d{7}$', phone):
            raise serializers.ValidationError("Неверный формат номера телефона")
        return value

class ContactListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'name', 'email', 'phone', 'subject', 'status', 'created_at']

class ContactDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'

class ContactUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['status', 'admin_notes']
