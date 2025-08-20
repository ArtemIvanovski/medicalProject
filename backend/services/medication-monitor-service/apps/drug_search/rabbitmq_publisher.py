import json
import logging
import pika
from django.conf import settings
from django.utils import timezone

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
            logger.warning("RabbitMQ not available, skipping event publication")
            return False
        
        try:
            message = json.dumps(message_data, default=str)
            self.channel.basic_publish(
                exchange=self.exchange_name,
                routing_key=routing_key,
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    timestamp=int(timezone.now().timestamp())
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

    def publish_medication_reminder(self, user_id, reminder_data):
        routing_key = "medication.reminder"
        message_data = {
            'user_id': user_id,
            'data': {
                'medication_name': reminder_data.get('medication_name'),
                'scheduled_time': reminder_data.get('scheduled_time'),
                'amount': reminder_data.get('amount'),
                'unit': reminder_data.get('unit'),
                'notes': reminder_data.get('notes', ''),
                'reminder_id': reminder_data.get('reminder_id')
            },
            'timestamp': timezone.now().isoformat()
        }
        return self.publish_event(routing_key, message_data)

    def publish_medication_missed(self, user_id, reminder_data):
        routing_key = "medication.missed"
        message_data = {
            'user_id': user_id,
            'data': {
                'medication_name': reminder_data.get('medication_name'),
                'scheduled_time': reminder_data.get('scheduled_time'),
                'amount': reminder_data.get('amount'),
                'unit': reminder_data.get('unit'),
                'notes': reminder_data.get('notes', ''),
                'reminder_id': reminder_data.get('reminder_id'),
                'missed_duration': reminder_data.get('missed_duration')
            },
            'timestamp': timezone.now().isoformat()
        }
        return self.publish_event(routing_key, message_data)
