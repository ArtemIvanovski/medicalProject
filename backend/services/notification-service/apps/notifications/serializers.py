from rest_framework import serializers
from .models import Notification, NotificationPreference, NotificationTemplate


class NotificationSerializer(serializers.ModelSerializer):
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Notification
        fields = [
            'id', 'user_id', 'title', 'message', 'type', 'priority',
            'category', 'is_read', 'read_at', 'created_at', 'expires_at',
            'data', 'is_expired'
        ]
        read_only_fields = ['id', 'created_at', 'read_at', 'is_expired']


class NotificationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'user_id', 'title', 'message', 'type', 'priority',
            'category', 'expires_at', 'data'
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'id', 'user_id', 'email_notifications', 'push_notifications',
            'glucose_alerts', 'medication_reminders', 'nutrition_suggestions',
            'system_notifications', 'quiet_hours_start', 'quiet_hours_end',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'name', 'title_template', 'message_template',
            'type', 'priority', 'category', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MarkAsReadSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
