from django.core.management.base import BaseCommand
from apps.notifications.rabbitmq_consumer import RabbitMQConsumer


class Command(BaseCommand):
    help = 'Start RabbitMQ consumer for notifications'

    def handle(self, *args, **options):
        self.stdout.write('Starting notification consumer...')
        consumer = RabbitMQConsumer()
        try:
            consumer.start_consuming()
        except KeyboardInterrupt:
            self.stdout.write('Stopping consumer...')
            consumer.stop()
            self.stdout.write('Consumer stopped.')
