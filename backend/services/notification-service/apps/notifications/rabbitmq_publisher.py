import json
import logging
import pika
from django.conf import settings

logger = logging.getLogger(__name__)


class RabbitMQPublisher:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.exchange_name = 'glucose_monitoring_events'

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
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False

    def publish_event(self, routing_key, message_data):
        if not self.connect():
            return False
        
        try:
            message = json.dumps(message_data)
            self.channel.basic_publish(
                exchange=self.exchange_name,
                routing_key=routing_key,
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    timestamp=int(timezone.now().timestamp()) if hasattr(timezone, 'now') else None
                )
            )
            
            logger.info(f"Published event: {routing_key}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")
            return False
        finally:
            if self.connection and not self.connection.is_closed:
                self.connection.close()

    def publish_glucose_alert(self, user_id, glucose_value, alert_type, **kwargs):
        routing_key = f"glucose.alert.{alert_type}"
        message_data = {
            'user_id': user_id,
            'data': {
                'glucose_value': glucose_value,
                'alert_type': alert_type,
                **kwargs
            }
        }
        return self.publish_event(routing_key, message_data)

    def publish_medication_reminder(self, user_id, medication_name, scheduled_time, **kwargs):
        routing_key = "medication.reminder"
        message_data = {
            'user_id': user_id,
            'data': {
                'medication_name': medication_name,
                'scheduled_time': scheduled_time,
                **kwargs
            }
        }
        return self.publish_event(routing_key, message_data)

    def publish_nutrition_suggestion(self, user_id, suggestion_type, details, **kwargs):
        routing_key = "nutrition.suggestion"
        message_data = {
            'user_id': user_id,
            'data': {
                'suggestion_type': suggestion_type,
                'details': details,
                **kwargs
            }
        }
        return self.publish_event(routing_key, message_data)

    def publish_system_event(self, event_type, message, user_ids=None, **kwargs):
        routing_key = f"system.{event_type}"
        
        if user_ids:
            for user_id in user_ids:
                message_data = {
                    'user_id': user_id,
                    'data': {
                        'message': message,
                        **kwargs
                    }
                }
                self.publish_event(routing_key, message_data)
        else:
            message_data = {
                'data': {
                    'message': message,
                    **kwargs
                }
            }
            self.publish_event(routing_key, message_data)
