from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.db import transaction
from .models import NewsletterSubscriber, NewsletterCampaign, NewsletterSendLog
from .serializers import (
    NewsletterSubscriberListSerializer,
    NewsletterCampaignSerializer,
    NewsletterCampaignCreateSerializer,
    NewsletterSendLogSerializer,
    BulkDeleteSerializer,
    NewsletterStatsSerializer
)
from .permissions import IsAdminUser
from .tasks import send_campaign, finalize_campaign
import logging

logger = logging.getLogger(__name__)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# Управление подписчиками

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_subscribers_list(request):
    """
    Получение списка всех подписчиков с фильтрацией и поиском
    """
    try:
        queryset = NewsletterSubscriber.objects.all()
        
        # Фильтрация по активности
        is_active = request.GET.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Поиск по email
        search = request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
            )
        
        # Сортировка
        ordering = request.GET.get('ordering', '-created_at')
        if ordering in ['email', '-email', 'created_at', '-created_at', 'is_active', '-is_active']:
            queryset = queryset.order_by(ordering)
        
        # Пагинация
        paginator = StandardResultsSetPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        
        serializer = NewsletterSubscriberListSerializer(paginated_queryset, many=True)
        
        return paginator.get_paginated_response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error in admin_subscribers_list: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при получении списка подписчиков.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_subscriber_delete(request, subscriber_id):
    """
    Удаление одного подписчика
    """
    try:
        subscriber = NewsletterSubscriber.objects.get(id=subscriber_id)
        email = subscriber.email
        subscriber.delete()
        
        logger.info(f"Admin deleted subscriber: {email}")
        
        return Response({
            'success': True,
            'message': f'Подписчик {email} успешно удален.'
        }, status=status.HTTP_200_OK)
        
    except NewsletterSubscriber.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Подписчик не найден.'
        }, status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        logger.error(f"Error deleting subscriber {subscriber_id}: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при удалении подписчика.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_subscribers_bulk_delete(request):
    """
    Массовое удаление подписчиков
    """
    try:
        serializer = BulkDeleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Ошибка валидации данных.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email_ids = serializer.validated_data['email_ids']
        
        # Получаем email адреса для логирования
        subscribers_to_delete = NewsletterSubscriber.objects.filter(
            id__in=email_ids
        ).values_list('email', flat=True)
        
        # Удаляем
        deleted_count, _ = NewsletterSubscriber.objects.filter(
            id__in=email_ids
        ).delete()
        
        logger.info(f"Admin bulk deleted {deleted_count} subscribers: {list(subscribers_to_delete)}")
        
        return Response({
            'success': True,
            'message': f'Успешно удалено {deleted_count} подписчиков.',
            'deleted_count': deleted_count
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in bulk delete: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при массовом удалении.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Управление кампаниями

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_campaigns_list(request):
    """
    Получение списка всех кампаний
    """
    try:
        queryset = NewsletterCampaign.objects.all()
        
        # Фильтрация по статусу
        status_filter = request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Поиск по названию или теме
        search = request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(subject__icontains=search)
            )
        
        # Сортировка
        ordering = request.GET.get('ordering', '-created_at')
        if ordering in ['title', '-title', 'created_at', '-created_at', 'status', '-status', 'scheduled_at', '-scheduled_at']:
            queryset = queryset.order_by(ordering)
        
        # Пагинация
        paginator = StandardResultsSetPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        
        serializer = NewsletterCampaignSerializer(paginated_queryset, many=True)
        
        return paginator.get_paginated_response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error in admin_campaigns_list: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при получении списка кампаний.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_campaign_create(request):
    """
    Создание новой кампании
    """
    try:
        # Получаем информацию об админе
        admin_email = getattr(request.user, 'email', 'unknown_admin')
        
        serializer = NewsletterCampaignCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Ошибка валидации данных.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем кампанию
        campaign = serializer.save(created_by_admin=admin_email)
        
        # Если нужно отправить сразу
        if serializer.validated_data.get('send_immediately', False):
            send_campaign.delay(campaign.id)
            finalize_campaign.apply_async(args=[campaign.id], countdown=600)  # Финализация через 10 мин
            
            message = 'Кампания создана и поставлена в очередь на отправку.'
        else:
            message = 'Кампания успешно создана.'
        
        logger.info(f"Admin {admin_email} created campaign: {campaign.title}")
        
        return Response({
            'success': True,
            'message': message,
            'campaign': NewsletterCampaignSerializer(campaign).data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при создании кампании.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_campaign_detail(request, campaign_id):
    """
    Получение деталей кампании
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        serializer = NewsletterCampaignSerializer(campaign)
        
        return Response({
            'success': True,
            'campaign': serializer.data
        }, status=status.HTTP_200_OK)
        
    except NewsletterCampaign.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Кампания не найдена.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_campaign_send(request, campaign_id):
    """
    Отправка кампании вручную
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        
        if campaign.status not in ['draft', 'scheduled']:
            return Response({
                'success': False,
                'message': f'Нельзя отправить кампанию со статусом "{campaign.get_status_display()}".'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Обновляем статус и запускаем отправку
        campaign.status = 'sending'
        campaign.save(update_fields=['status'])
        
        send_campaign.delay(campaign.id)
        finalize_campaign.apply_async(args=[campaign.id], countdown=600)
        
        logger.info(f"Admin manually started campaign: {campaign.title}")
        
        return Response({
            'success': True,
            'message': 'Кампания поставлена в очередь на отправку.'
        }, status=status.HTTP_200_OK)
        
    except NewsletterCampaign.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Кампания не найдена.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_campaign_cancel(request, campaign_id):
    """
    Отмена кампании
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        
        if campaign.status not in ['draft', 'scheduled']:
            return Response({
                'success': False,
                'message': f'Нельзя отменить кампанию со статусом "{campaign.get_status_display()}".'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        campaign.status = 'cancelled'
        campaign.save(update_fields=['status'])
        
        logger.info(f"Admin cancelled campaign: {campaign.title}")
        
        return Response({
            'success': True,
            'message': 'Кампания отменена.'
        }, status=status.HTTP_200_OK)
        
    except NewsletterCampaign.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Кампания не найдена.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_campaign_delete(request, campaign_id):
    """
    Удаление кампании
    """
    try:
        campaign = NewsletterCampaign.objects.get(id=campaign_id)
        
        if campaign.status in ['sending']:
            return Response({
                'success': False,
                'message': 'Нельзя удалить кампанию которая отправляется.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        title = campaign.title
        campaign.delete()
        
        logger.info(f"Admin deleted campaign: {title}")
        
        return Response({
            'success': True,
            'message': f'Кампания "{title}" удалена.'
        }, status=status.HTTP_200_OK)
        
    except NewsletterCampaign.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Кампания не найдена.'
        }, status=status.HTTP_404_NOT_FOUND)


# Логи отправки

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_send_logs(request):
    """
    Получение логов отправки
    """
    try:
        queryset = NewsletterSendLog.objects.select_related('campaign', 'subscriber')
        
        # Фильтрация по кампании
        campaign_id = request.GET.get('campaign_id')
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        
        # Фильтрация по статусу
        status_filter = request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Поиск по email
        search = request.GET.get('search')
        if search:
            queryset = queryset.filter(subscriber__email__icontains=search)
        
        # Пагинация
        paginator = StandardResultsSetPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        
        serializer = NewsletterSendLogSerializer(paginated_queryset, many=True)
        
        return paginator.get_paginated_response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error in admin_send_logs: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при получении логов.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Статистика

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_newsletter_stats(request):
    """
    Получение статистики рассылок
    """
    try:
        # Статистика подписчиков
        total_subscribers = NewsletterSubscriber.objects.count()
        active_subscribers = NewsletterSubscriber.objects.filter(is_active=True).count()
        
        # Статистика кампаний
        campaigns_stats = NewsletterCampaign.objects.aggregate(
            total_campaigns=Count('id'),
            sent_campaigns=Count('id', filter=Q(status='sent')),
            scheduled_campaigns=Count('id', filter=Q(status='scheduled')),
            average_success_rate=Avg('successful_sends') / Avg('total_recipients') * 100
        )
        
        # Общее количество отправленных писем
        total_emails_sent = NewsletterCampaign.objects.filter(
            status='sent'
        ).aggregate(
            total=Count('successful_sends')
        )['total'] or 0
        
        stats_data = {
            'total_subscribers': total_subscribers,
            'active_subscribers': active_subscribers,
            'total_campaigns': campaigns_stats['total_campaigns'] or 0,
            'sent_campaigns': campaigns_stats['sent_campaigns'] or 0,
            'scheduled_campaigns': campaigns_stats['scheduled_campaigns'] or 0,
            'total_emails_sent': total_emails_sent,
            'average_success_rate': round(campaigns_stats['average_success_rate'] or 0, 2)
        }
        
        serializer = NewsletterStatsSerializer(stats_data)
        
        return Response({
            'success': True,
            'stats': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in admin_newsletter_stats: {e}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка при получении статистики.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
