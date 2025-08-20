import logging
from django.utils import timezone
from .models import Notification, NotificationTemplate

logger = logging.getLogger(__name__)


class NotificationService:
    
    def create_notification(self, user_id, template_name=None, title=None, 
                          message=None, context_data=None, **kwargs):
        if template_name:
            return self.create_from_template(
                user_id=user_id,
                template_name=template_name,
                context_data=context_data or {},
                **kwargs
            )
        else:
            return self.create_direct(
                user_id=user_id,
                title=title,
                message=message,
                **kwargs
            )
    
    def create_from_template(self, user_id, template_name, context_data, **kwargs):
        try:
            template = NotificationTemplate.objects.get(
                name=template_name,
                is_active=True
            )
        except NotificationTemplate.DoesNotExist:
            logger.error(f"Template '{template_name}' not found")
            return None
        
        title = self.render_template(template.title_template, context_data)
        message = self.render_template(template.message_template, context_data)
        
        notification_data = {
            'user_id': user_id,
            'title': title,
            'message': message,
            'type': kwargs.get('type', template.type),
            'priority': kwargs.get('priority', template.priority),
            'category': kwargs.get('category', template.category),
            'expires_at': kwargs.get('expires_at'),
            'data': context_data
        }
        
        return self.create_direct(**notification_data)
    
    def create_direct(self, user_id, title, message, **kwargs):
        notification = Notification.objects.create(
            user_id=user_id,
            title=title,
            message=message,
            type=kwargs.get('type', 'info'),
            priority=kwargs.get('priority', 'medium'),
            category=kwargs.get('category', 'system'),
            expires_at=kwargs.get('expires_at'),
            data=kwargs.get('data', {})
        )
        
        logger.info(f"Notification created: {notification.id} for user {user_id}")
        return notification
    
    def render_template(self, template_string, context_data):
        try:
            return template_string.format(**context_data)
        except (KeyError, ValueError) as e:
            logger.warning(f"Template rendering error: {e}")
            return template_string
    
    def bulk_create_notifications(self, notifications_data):
        notifications = []
        for data in notifications_data:
            notification = Notification(
                user_id=data['user_id'],
                title=data['title'],
                message=data['message'],
                type=data.get('type', 'info'),
                priority=data.get('priority', 'medium'),
                category=data.get('category', 'system'),
                expires_at=data.get('expires_at'),
                data=data.get('data', {})
            )
            notifications.append(notification)
        
        created_notifications = Notification.objects.bulk_create(notifications)
        logger.info(f"Bulk created {len(created_notifications)} notifications")
        return created_notifications
    
    def cleanup_expired_notifications(self):
        expired_count = Notification.objects.filter(
            expires_at__lt=timezone.now()
        ).delete()[0]
        
        logger.info(f"Cleaned up {expired_count} expired notifications")
        return expired_count
