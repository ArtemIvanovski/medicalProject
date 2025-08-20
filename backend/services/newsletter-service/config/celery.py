import os
from celery import Celery
from django.conf import settings

# Устанавливаем настройки Django для Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('newsletter_service')

# Используем Redis как брокер и результат бэкенд
app.config_from_object('django.conf:settings', namespace='CELERY')

# Автоматически находим задачи в Django приложениях
app.autodiscover_tasks()

# Настройки Celery Beat для периодических задач
app.conf.beat_schedule = {
    'process-scheduled-campaigns': {
        'task': 'apps.newsletter.tasks.process_scheduled_campaigns',
        'schedule': 60.0,  # Каждую минуту
    },
    'cleanup-old-logs': {
        'task': 'apps.newsletter.tasks.cleanup_old_logs',
        'schedule': 86400.0,  # Каждый день
    },
}

app.conf.timezone = 'UTC'


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
