from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from apps.drug_search.models import User, Drug, MedicationReminder


class Command(BaseCommand):
    help = 'Create test medication reminders for demonstration'

    def handle(self, *args, **options):
        try:
            user = User.objects.first()
            if not user:
                self.stdout.write('No users found. Please create a user first.')
                return

            drug, created = Drug.objects.get_or_create(
                name='Метформин',
                form='Таблетки',
                defaults={'description': 'Препарат для лечения диабета'}
            )

            current_time = timezone.now()
            reminder_time = (current_time + timedelta(minutes=2)).time()

            reminder, created = MedicationReminder.objects.get_or_create(
                user=user,
                drug=drug,
                defaults={
                    'title': f'Принять {drug.name}',
                    'amount': 1.0,
                    'unit': 'pieces',
                    'frequency': 'daily',
                    'time': reminder_time,
                    'start_date': current_time.date(),
                    'is_active': True,
                    'notes': 'Тестовое напоминание'
                }
            )

            if created:
                self.stdout.write(
                    f'Created test reminder: {reminder.title} at {reminder.time} for user {user.email}'
                )
            else:
                reminder.time = reminder_time
                reminder.is_active = True
                reminder.save()
                self.stdout.write(
                    f'Updated existing reminder: {reminder.title} at {reminder.time} for user {user.email}'
                )

            self.stdout.write(f'Reminder will trigger in approximately 2 minutes at {reminder_time}')
            
        except Exception as e:
            self.stdout.write(f'Error creating test reminder: {e}')
