import json
import logging
import pika
from django.conf import settings
from django.utils import timezone
from .models import Notification, NotificationTemplate, NotificationPreference
from .services import NotificationService

logger = logging.getLogger(__name__)


class RabbitMQConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.exchange_name = 'glucose_monitoring_events'
        self.queue_name = 'notification_queue'
        self.notification_service = NotificationService()

    def connect(self):
        try:
            connection_params = pika.URLParameters(settings.RABBITMQ_URL)
            self.connection = pika.BlockingConnection(connection_params)
            self.channel = self.connection.channel()
            
            self.channel.exchange_declare(
                exchange=self.exchange_name,
                exchange_type='topic',
                durable=True
            )
            
            self.channel.queue_declare(queue=self.queue_name, durable=True)
            
            routing_keys = [
                'glucose.alert.high',
                'glucose.alert.low',
                'glucose.alert.critical',
                'medication.reminder',
                'medication.missed',
                'nutrition.suggestion',
                'system.maintenance',
                'user.registration',
                'user.login_suspicious',
            ]
            
            for routing_key in routing_keys:
                self.channel.queue_bind(
                    exchange=self.exchange_name,
                    queue=self.queue_name,
                    routing_key=routing_key
                )
            
            logger.info("RabbitMQ connection established")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False

    def process_message(self, channel, method, properties, body):
        try:
            message = json.loads(body.decode('utf-8'))
            routing_key = method.routing_key
            
            logger.info(f"Processing message with routing key: {routing_key}")
            
            user_id = message.get('user_id')
            if not user_id:
                logger.warning("Message missing user_id, skipping")
                channel.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            preferences = self.get_user_preferences(user_id)
            if not self.should_send_notification(routing_key, preferences):
                logger.info(f"User {user_id} has disabled notifications for {routing_key}")
                channel.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            notification_data = self.map_event_to_notification(routing_key, message)
            if notification_data:
                self.notification_service.create_notification(**notification_data)
                logger.info(f"Notification created for user {user_id}")
            
            channel.basic_ack(delivery_tag=method.delivery_tag)
            
        except json.JSONDecodeError:
            logger.error("Failed to decode message JSON")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def get_user_preferences(self, user_id):
        try:
            return NotificationPreference.objects.get(user_id=user_id)
        except NotificationPreference.DoesNotExist:
            return NotificationPreference(user_id=user_id)

    def should_send_notification(self, routing_key, preferences):
        if routing_key.startswith('glucose.'):
            return preferences.glucose_alerts
        elif routing_key.startswith('medication.'):
            return preferences.medication_reminders
        elif routing_key.startswith('nutrition.'):
            return preferences.nutrition_suggestions
        elif routing_key.startswith('system.'):
            return preferences.system_notifications
        return True

    def map_event_to_notification(self, routing_key, message):
        mapping = {
            'glucose.alert.high': {
                'template_name': 'glucose_high_alert',
                'priority': 'high',
                'category': 'glucose',
                'type': 'warning'
            },
            'glucose.alert.low': {
                'template_name': 'glucose_low_alert',
                'priority': 'high',
                'category': 'glucose',
                'type': 'warning'
            },
            'glucose.alert.critical': {
                'template_name': 'glucose_critical_alert',
                'priority': 'critical',
                'category': 'glucose',
                'type': 'error'
            },
            'medication.reminder': {
                'template_name': 'medication_reminder',
                'priority': 'medium',
                'category': 'medication',
                'type': 'info'
            },
            'medication.missed': {
                'template_name': 'medication_missed',
                'priority': 'high',
                'category': 'medication',
                'type': 'warning'
            },
            'nutrition.suggestion': {
                'template_name': 'nutrition_suggestion',
                'priority': 'low',
                'category': 'nutrition',
                'type': 'info'
            },
            'system.maintenance': {
                'template_name': 'system_maintenance',
                'priority': 'medium',
                'category': 'system',
                'type': 'info'
            },
            'user.registration': {
                'template_name': 'welcome_message',
                'priority': 'low',
                'category': 'system',
                'type': 'success'
            },
            'user.login_suspicious': {
                'template_name': 'suspicious_login',
                'priority': 'high',
                'category': 'system',
                'type': 'warning'
            }
        }
        
        config = mapping.get(routing_key)
        if not config:
            logger.warning(f"No mapping found for routing key: {routing_key}")
            return None
        
        return {
            'user_id': message['user_id'],
            'template_name': config['template_name'],
            'context_data': message.get('data', {}),
            'priority': config['priority'],
            'category': config['category'],
            'type': config['type'],
            'expires_at': message.get('expires_at')
        }

    def start_consuming(self):
        if not self.connect():
            return
        
        try:
            self.channel.basic_qos(prefetch_count=1)
            self.channel.basic_consume(
                queue=self.queue_name,
                on_message_callback=self.process_message
            )
            
            logger.info("Starting to consume messages...")
            self.channel.start_consuming()
            
        except KeyboardInterrupt:
            logger.info("Stopping consumer...")
            self.channel.stop_consuming()
            if self.connection and not self.connection.is_closed:
                self.connection.close()
        except Exception as e:
            logger.error(f"Error in consumer: {e}")
            if self.connection and not self.connection.is_closed:
                self.connection.close()

    def stop(self):
        if self.channel:
            self.channel.stop_consuming()
        if self.connection and not self.connection.is_closed:
            self.connection.close()
