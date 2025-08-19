from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from .models import NewsletterCampaign, NewsletterSubscriber, NewsletterSendLog
import logging
import time
from html2text import html2text

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_campaign_email(self, campaign_id, subscriber_id):
    """
    Отправка одного письма в рамках кампании
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        subscriber = NewsletterSubscriber.objects.get(id=subscriber_id)
        
        # Создаем или получаем лог отправки
        send_log, created = NewsletterSendLog.objects.get_or_create(
            campaign=campaign,
            subscriber=subscriber,
            defaults={'status': 'pending'}
        )
        
        if send_log.status == 'sent':
            logger.info(f"Email уже отправлен: {subscriber.email}")
            return
        
        # Генерируем текстовую версию из HTML если нет
        plain_content = campaign.plain_content or html2text(campaign.html_content)
        
        # Отправляем письмо
        success = send_mail(
            subject=campaign.subject,
            message=plain_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[subscriber.email],
            html_message=campaign.html_content,
            fail_silently=False,
        )
        
        if success:
            # Обновляем лог
            send_log.status = 'sent'
            send_log.sent_at = timezone.now()
            send_log.save()
            
            # Обновляем счетчики кампании
            with transaction.atomic():
                campaign.successful_sends += 1
                campaign.save(update_fields=['successful_sends'])
            
            logger.info(f"Email отправлен успешно: {subscriber.email}")
        else:
            raise Exception("Не удалось отправить email")
            
    except Exception as exc:
        logger.error(f"Ошибка отправки email {subscriber_id}: {exc}")
        
        # Обновляем лог об ошибке
        try:
            send_log.status = 'failed'
            send_log.error_message = str(exc)
            send_log.save()
            
            # Обновляем счетчики кампании
            with transaction.atomic():
                campaign.failed_sends += 1
                campaign.save(update_fields=['failed_sends'])
        except:
            pass
        
        # Retry задачи
        if self.request.retries < self.max_retries:
            # Exponential backoff: 60s, 180s, 540s
            countdown = 60 * (3 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=exc)
        
        raise exc


@shared_task
def send_campaign(campaign_id):
    """
    Отправка всей кампании
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        
        if campaign.status not in ['sending', 'scheduled']:
            logger.warning(f"Кампания {campaign_id} не готова к отправке: {campaign.status}")
            return
        
        # Обновляем статус
        campaign.status = 'sending'
        campaign.save(update_fields=['status'])
        
        # Получаем активных подписчиков
        active_subscribers = NewsletterSubscriber.objects.filter(is_active=True)
        total_recipients = active_subscribers.count()
        
        if total_recipients == 0:
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
            logger.warning(f"Нет активных подписчиков для кампании {campaign_id}")
            return
        
        # Обновляем общее количество получателей
        campaign.total_recipients = total_recipients
        campaign.save(update_fields=['total_recipients'])
        
        logger.info(f"Начинаем отправку кампании {campaign_id} для {total_recipients} получателей")
        
        # Создаем задачи для отправки каждому подписчику
        for subscriber in active_subscribers:
            send_campaign_email.delay(campaign_id, subscriber.id)
        
        logger.info(f"Создано {total_recipients} задач отправки для кампании {campaign_id}")
        
    except Exception as exc:
        logger.error(f"Ошибка при отправке кампании {campaign_id}: {exc}")
        try:
            campaign = NewsletterCampaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
        except:
            pass
        raise exc


@shared_task
def finalize_campaign(campaign_id):
    """
    Завершение кампании после отправки всех писем
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        
        # Проверяем что все письма обработаны
        total_processed = campaign.successful_sends + campaign.failed_sends
        
        if total_processed >= campaign.total_recipients:
            campaign.status = 'sent'
            campaign.sent_at = timezone.now()
            campaign.save(update_fields=['status', 'sent_at'])
            
            logger.info(f"Кампания {campaign_id} завершена. "
                       f"Успешно: {campaign.successful_sends}, "
                       f"Ошибок: {campaign.failed_sends}")
        else:
            logger.info(f"Кампания {campaign_id} еще обрабатывается: "
                       f"{total_processed}/{campaign.total_recipients}")
            
            # Перепланируем проверку через 5 минут
            finalize_campaign.apply_async(args=[campaign_id], countdown=300)
            
    except Exception as exc:
        logger.error(f"Ошибка завершения кампании {campaign_id}: {exc}")


@shared_task
def process_scheduled_campaigns():
    """
    Обработка запланированных кампаний
    Запускается по расписанию каждую минуту
    """
    now = timezone.now()
    
    # Находим кампании готовые к отправке
    scheduled_campaigns = NewsletterCampaign.objects.filter(
        status='scheduled',
        scheduled_at__lte=now
    )
    
    for campaign in scheduled_campaigns:
        logger.info(f"Запускаем запланированную кампанию {campaign.id}")
        send_campaign.delay(campaign.id)
        
        # Планируем финализацию через 10 минут
        finalize_campaign.apply_async(args=[campaign.id], countdown=600)


@shared_task
def cleanup_old_logs():
    """
    Очистка старых логов отправки (старше 90 дней)
    Запускается раз в день
    """
    cutoff_date = timezone.now() - timezone.timedelta(days=90)
    
    deleted_count, _ = NewsletterSendLog.objects.filter(
        sent_at__lt=cutoff_date
    ).delete()
    
    logger.info(f"Удалено {deleted_count} старых логов отправки")
