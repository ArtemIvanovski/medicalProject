from rest_framework import serializers
from django.utils import timezone
from .models import User, Chat, Message, MessageAttachment, MessageStatus
from .services import PermissionService


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'patronymic', 'full_name', 'avatar_url']

    def get_full_name(self, obj):
        parts = [obj.first_name, obj.last_name]
        if obj.patronymic:
            parts.insert(1, obj.patronymic)
        return ' '.join(filter(None, parts))

    def get_avatar_url(self, obj):
        if obj.avatar_drive_id:
            return f"/api/v1/files/{obj.avatar_drive_id}/"
        return None


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ['id', 'file_name', 'file_size', 'mime_type', 'file_url', 'thumbnail_url']

    def get_file_url(self, obj):
        return f"/api/v1/files/{obj.drive_file_id}/"

    def get_thumbnail_url(self, obj):
        if obj.thumbnail_drive_id:
            return f"/api/v1/files/{obj.thumbnail_drive_id}/"
        return None


class MessageStatusSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = MessageStatus
        fields = ['user', 'status', 'timestamp']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    statuses = MessageStatusSerializer(many=True, read_only=True)
    reply_to = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete_for_everyone = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'message_type', 'content', 'sent_at', 'edited_at',
            'is_edited', 'reply_to', 'attachments', 'statuses', 'can_edit',
            'can_delete_for_everyone'
        ]

    def get_content(self, obj):
        return obj.decrypt_content()

    def get_reply_to(self, obj):
        if obj.reply_to and not obj.reply_to.is_deleted_for_everyone:
            return {
                'id': obj.reply_to.id,
                'sender': UserSerializer(obj.reply_to.sender).data,
                'content': obj.reply_to.decrypt_content()[:100],
                'message_type': obj.reply_to.message_type
            }
        return None

    def get_can_edit(self, obj):
        return obj.can_edit()

    def get_can_delete_for_everyone(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.sender:
            return obj.can_delete_for_everyone()
        return False


class ChatSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    last_message = MessageSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    companion = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ['id', 'participants', 'last_message', 'unread_count', 'companion', 'updated_at']

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return 0

        return Message.objects.filter(
            chat=obj,
            is_deleted=False,
            is_deleted_for_everyone=False
        ).exclude(
            sender=request.user
        ).exclude(
            statuses__user=request.user,
            statuses__status='read'
        ).count()

    def get_companion(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return None

        companion = obj.participants.exclude(id=request.user.id).first()
        return UserSerializer(companion).data if companion else None


class SendMessageSerializer(serializers.Serializer):
    recipient_id = serializers.UUIDField()
    message_type = serializers.ChoiceField(choices=Message.MESSAGE_TYPES, default='text')
    content = serializers.CharField(required=False, allow_blank=True)
    reply_to_id = serializers.UUIDField(required=False, allow_null=True)
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
        max_length=10
    )

    def validate_recipient_id(self, value):
        try:
            recipient = User.objects.get(id=value, is_deleted=False)
        except User.DoesNotExist:
            raise serializers.ValidationError("Recipient not found")

        request = self.context.get('request')
        if request and request.user:
            if not PermissionService.can_send_message(request.user, recipient):
                raise serializers.ValidationError("You don't have permission to send messages to this user")

        return value

    def validate_attachments(self, value):
        max_size = 20 * 1024 * 1024
        for file in value:
            if file.size > max_size:
                raise serializers.ValidationError(f"File {file.name} is too large. Maximum size is 20MB")
        return value

    def validate(self, data):
        if data.get('message_type') == 'text' and not data.get('content'):
            if not data.get('attachments'):
                raise serializers.ValidationError("Text message must have content or attachments")
        return data


class EditMessageSerializer(serializers.Serializer):
    content = serializers.CharField()

    def validate(self, data):
        message = self.context.get('message')
        if not message:
            raise serializers.ValidationError("Message not found")

        if not message.can_edit():
            raise serializers.ValidationError("Message can only be edited within 24 hours")

        request = self.context.get('request')
        if request and request.user != message.sender:
            raise serializers.ValidationError("You can only edit your own messages")

        return data


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()
    can_send_message = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'avatar_url', 'last_seen', 'can_send_message']

    def get_full_name(self, obj):
        parts = [obj.first_name, obj.last_name]
        if obj.patronymic:
            parts.insert(1, obj.patronymic)
        return ' '.join(filter(None, parts))

    def get_avatar_url(self, obj):
        if obj.avatar_drive_id:
            return f"/api/v1/files/{obj.avatar_drive_id}/"
        return None

    def get_last_seen(self, obj):
        return obj.last_login

    def get_can_send_message(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return PermissionService.can_send_message(request.user, obj)
        return False