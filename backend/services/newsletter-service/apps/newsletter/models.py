from django.db import models
from django.core.validators import EmailValidator
from django.utils import timezone
import uuid


class NewsletterSubscriber(models.Model):
    """Модель для хранения подписчиков рассылки"""
    
    email = models.EmailField(
        unique=True,
        validators=[EmailValidator()],
        verbose_name="Email адрес",
        help_text="Уникальный email адрес подписчика"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата подписки"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Активная подписка"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP адрес"
    )
    user_agent = models.TextField(
        null=True,
        blank=True,
        verbose_name="User Agent"
    )

    class Meta:
        db_table = 'newsletter_subscribers'
        verbose_name = "Подписчик рассылки"
        verbose_name_plural = "Подписчики рассылки"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} ({'активен' if self.is_active else 'неактивен'})"


class NewsletterCampaign(models.Model):
    """Модель для рассылочных кампаний"""
    
    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('scheduled', 'Запланирована'),
        ('sending', 'Отправляется'),
        ('sent', 'Отправлена'),
        ('failed', 'Ошибка'),
        ('cancelled', 'Отменена'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(
        max_length=255,
        verbose_name="Название кампании"
    )
    subject = models.CharField(
        max_length=255,
        verbose_name="Тема письма"
    )
    html_content = models.TextField(
        verbose_name="HTML содержимое"
    )
    plain_content = models.TextField(
        blank=True,
        verbose_name="Текстовое содержимое"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name="Статус"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата создания"
    )
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Запланированная дата отправки"
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Дата отправки"
    )
    created_by_admin = models.CharField(
        max_length=255,
        verbose_name="Создано администратором"
    )
    total_recipients = models.IntegerField(
        default=0,
        verbose_name="Общее количество получателей"
    )
    successful_sends = models.IntegerField(
        default=0,
        verbose_name="Успешных отправок"
    )
    failed_sends = models.IntegerField(
        default=0,
        verbose_name="Неуспешных отправок"
    )

    class Meta:
        db_table = 'newsletter_campaigns'
        verbose_name = "Рассылочная кампания"
        verbose_name_plural = "Рассылочные кампании"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    @property
    def success_rate(self):
        """Процент успешности доставки"""
        if self.total_recipients == 0:
            return 0
        return round((self.successful_sends / self.total_recipients) * 100, 2)


class NewsletterSendLog(models.Model):
    """Лог отправки писем"""
    
    STATUS_CHOICES = [
        ('pending', 'Ожидает отправки'),
        ('sent', 'Отправлено'),
        ('failed', 'Ошибка'),
        ('bounced', 'Отклонено'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(
        NewsletterCampaign,
        on_delete=models.CASCADE,
        related_name='send_logs',
        verbose_name="Кампания"
    )
    subscriber = models.ForeignKey(
        NewsletterSubscriber,
        on_delete=models.CASCADE,
        verbose_name="Подписчик"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name="Статус отправки"
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Время отправки"
    )
    error_message = models.TextField(
        blank=True,
        verbose_name="Сообщение об ошибке"
    )

    class Meta:
        db_table = 'newsletter_send_logs'
        verbose_name = "Лог отправки"
        verbose_name_plural = "Логи отправки"
        ordering = ['-sent_at']
        unique_together = ['campaign', 'subscriber']

    def __str__(self):
        return f"{self.campaign.title} -> {self.subscriber.email}"
