from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from .models import NewsletterSubscriber
from .serializers import NewsletterSubscriberSerializer, NewsletterUnsubscribeSerializer
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@ratelimit(key='ip', rate='5/m', method='POST', block=True)  # 5 запросов в минуту с одного IP
@ratelimit(key='header:user-agent', rate='10/m', method='POST', block=True)  # 10 запросов в минуту с одного User-Agent
def subscribe_newsletter(request):
    """
    Подписка на рассылку новостей.
    
    POST /api/newsletter/subscribe/
    {
        "email": "user@example.com"
    }
    """
    try:
        serializer = NewsletterSubscriberSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            try:
                subscriber = serializer.save()
                logger.info(f"New newsletter subscription: {subscriber.email} from IP: {subscriber.ip_address}")
                
                return Response({
                    'success': True,
                    'message': 'Вы успешно подписались на рассылку новостей!',
                    'email': subscriber.email
                }, status=status.HTTP_201_CREATED)
                
            except IntegrityError:
                # Дополнительная защита от дублирования на уровне БД
                return Response({
                    'success': False,
                    'message': 'Этот email уже подписан на рассылку.',
                    'errors': {'email': ['Этот email уже подписан на рассылку.']}
                }, status=status.HTTP_400_BAD_REQUEST)
                
        else:
            return Response({
                'success': False,
                'message': 'Ошибка валидации данных.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error in newsletter subscription: {str(e)}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка сервера. Попробуйте позже.',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@ratelimit(key='ip', rate='3/m', method='POST', block=True)  # 3 запроса в минуту на отписку
def unsubscribe_newsletter(request):
    """
    Отписка от рассылки новостей.
    
    POST /api/newsletter/unsubscribe/
    {
        "email": "user@example.com"
    }
    """
    try:
        serializer = NewsletterUnsubscribeSerializer(data=request.data)
        
        if serializer.is_valid():
            email = serializer.validated_data['email']
            
            # Деактивируем подписку вместо удаления
            updated_count = NewsletterSubscriber.objects.filter(
                email=email,
                is_active=True
            ).update(is_active=False)
            
            if updated_count > 0:
                logger.info(f"Newsletter unsubscription: {email}")
                return Response({
                    'success': True,
                    'message': 'Вы успешно отписались от рассылки.',
                    'email': email
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Email не найден в активных подписках.',
                    'errors': {'email': ['Email не найден в активных подписках.']}
                }, status=status.HTTP_400_BAD_REQUEST)
                
        else:
            return Response({
                'success': False,
                'message': 'Ошибка валидации данных.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error in newsletter unsubscription: {str(e)}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка сервера. Попробуйте позже.',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def newsletter_stats(request):
    """
    Получение статистики подписок (только общие данные).
    
    GET /api/newsletter/stats/
    """
    try:
        total_subscribers = NewsletterSubscriber.objects.filter(is_active=True).count()
        total_all_time = NewsletterSubscriber.objects.count()
        
        return Response({
            'success': True,
            'data': {
                'active_subscribers': total_subscribers,
                'total_subscribers_all_time': total_all_time,
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting newsletter stats: {str(e)}")
        return Response({
            'success': False,
            'message': 'Произошла ошибка сервера. Попробуйте позже.',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
