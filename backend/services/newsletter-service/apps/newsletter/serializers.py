from rest_framework import serializers
from django.core.validators import EmailValidator
from django.utils import timezone
from .models import NewsletterSubscriber, NewsletterCampaign, NewsletterSendLog


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    """Сериализатор для подписчиков рассылки"""
    
    email = serializers.EmailField(
        validators=[EmailValidator()],
        error_messages={
            'invalid': 'Введите корректный email адрес.',
            'required': 'Email адрес обязателен для заполнения.',
        }
    )

    class Meta:
        model = NewsletterSubscriber
        fields = ['email']

    def validate_email(self, value):
        """Проверка уникальности email"""
        email = value.lower().strip()
        
        if NewsletterSubscriber.objects.filter(email=email).exists():
            raise serializers.ValidationError("Этот email уже подписан на рассылку.")
        
        return email

    def create(self, validated_data):
        """Создание нового подписчика с дополнительными данными"""
        request = self.context.get('request')
        
        # Получаем IP адрес и User Agent из запроса
        ip_address = None
        user_agent = None
        
        if request:
            # Получаем реальный IP через прокси
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Ограничиваем длину
        
        validated_data['ip_address'] = ip_address
        validated_data['user_agent'] = user_agent
        validated_data['email'] = validated_data['email'].lower().strip()
        
        return super().create(validated_data)


class NewsletterUnsubscribeSerializer(serializers.Serializer):
    """Сериализатор для отписки от рассылки"""
    
    email = serializers.EmailField(
        validators=[EmailValidator()],
        error_messages={
            'invalid': 'Введите корректный email адрес.',
            'required': 'Email адрес обязателен для заполнения.',
        }
    )

    def validate_email(self, value):
        """Проверка существования email в подписках"""
        email = value.lower().strip()
        
        if not NewsletterSubscriber.objects.filter(email=email, is_active=True).exists():
            raise serializers.ValidationError("Этот email не найден в активных подписках.")
        
        return email


# Админские сериализаторы

class NewsletterSubscriberListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка подписчиков (для админа)"""
    
    class Meta:
        model = NewsletterSubscriber
        fields = ['id', 'email', 'created_at', 'is_active', 'ip_address']
        read_only_fields = ['id', 'created_at']


class NewsletterCampaignSerializer(serializers.ModelSerializer):
    """Сериализатор для кампаний рассылки"""
    
    success_rate = serializers.ReadOnlyField()
    
    class Meta:
        model = NewsletterCampaign
        fields = [
            'id', 'title', 'subject', 'html_content', 'plain_content',
            'status', 'created_at', 'scheduled_at', 'sent_at', 'created_by_admin',
            'total_recipients', 'successful_sends', 'failed_sends', 'success_rate'
        ]
        read_only_fields = [
            'id', 'created_at', 'sent_at', 'total_recipients', 
            'successful_sends', 'failed_sends', 'success_rate'
        ]
    
    def validate_scheduled_at(self, value):
        """Проверка что дата в будущем"""
        if value and value <= timezone.now():
            raise serializers.ValidationError("Дата планирования должна быть в будущем.")
        return value
    
    def validate_html_content(self, value):
        """Базовая валидация HTML"""
        if not value.strip():
            raise serializers.ValidationError("HTML содержимое не может быть пустым.")
        return value


class NewsletterCampaignCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания кампании"""
    
    send_immediately = serializers.BooleanField(default=False, write_only=True)
    
    class Meta:
        model = NewsletterCampaign
        fields = [
            'title', 'subject', 'html_content', 'plain_content',
            'scheduled_at', 'send_immediately'
        ]
    
    def validate(self, data):
        """Валидация данных"""
        send_immediately = data.get('send_immediately', False)
        scheduled_at = data.get('scheduled_at')
        
        if send_immediately and scheduled_at:
            raise serializers.ValidationError(
                "Нельзя одновременно отправить сразу и запланировать на потом."
            )
        
        if not send_immediately and not scheduled_at:
            # Если не указано время отправки - создаем черновик
            data['status'] = 'draft'
        elif send_immediately:
            data['status'] = 'sending'
        else:
            data['status'] = 'scheduled'
        
        return data


class NewsletterSendLogSerializer(serializers.ModelSerializer):
    """Сериализатор для логов отправки"""
    
    subscriber_email = serializers.CharField(source='subscriber.email', read_only=True)
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    
    class Meta:
        model = NewsletterSendLog
        fields = [
            'id', 'campaign_title', 'subscriber_email', 'status',
            'sent_at', 'error_message'
        ]
        read_only_fields = ['id']


class BulkDeleteSerializer(serializers.Serializer):
    """Сериализатор для массового удаления подписчиков"""
    
    email_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        error_messages={
            'min_length': 'Необходимо указать хотя бы одного подписчика для удаления.'
        }
    )
    
    def validate_email_ids(self, value):
        """Проверка что все ID существуют"""
        existing_ids = set(
            NewsletterSubscriber.objects.filter(
                id__in=value
            ).values_list('id', flat=True)
        )
        
        invalid_ids = set(value) - existing_ids
        if invalid_ids:
            raise serializers.ValidationError(
                f"Подписчики с ID {list(invalid_ids)} не найдены."
            )
        
        return value


class NewsletterStatsSerializer(serializers.Serializer):
    """Сериализатор для статистики рассылок"""
    
    total_subscribers = serializers.IntegerField()
    active_subscribers = serializers.IntegerField()
    total_campaigns = serializers.IntegerField()
    sent_campaigns = serializers.IntegerField()
    scheduled_campaigns = serializers.IntegerField()
    total_emails_sent = serializers.IntegerField()
    average_success_rate = serializers.FloatField()
