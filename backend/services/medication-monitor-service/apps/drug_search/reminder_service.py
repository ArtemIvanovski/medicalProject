import logging
from datetime import datetime, time, timedelta
from django.utils import timezone
from django.db.models import Q
from .models import MedicationReminder, MedicationIntake
from .rabbitmq_publisher import RabbitMQPublisher

logger = logging.getLogger(__name__)


class MedicationReminderService:
    def __init__(self):
        self.publisher = RabbitMQPublisher()

    def check_and_send_reminders(self):
        current_time = timezone.now()
        current_date = current_time.date()
        current_weekday = current_time.strftime('%A').lower()
        
        logger.info(f"Checking medication reminders at {current_time}")
        
        active_reminders = MedicationReminder.objects.filter(
            is_active=True,
            start_date__lte=current_date
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=current_date)
        )
        
        reminders_sent = 0
        
        for reminder in active_reminders:
            if self.should_send_reminder(reminder, current_time, current_weekday):
                if not self.has_taken_medication_today(reminder, current_date):
                    self.send_reminder_notification(reminder)
                    reminders_sent += 1
                else:
                    logger.info(f"User {reminder.user.email} already took {reminder.drug.name} today")
        
        logger.info(f"Sent {reminders_sent} medication reminders")
        return reminders_sent

    def should_send_reminder(self, reminder, current_time, current_weekday):
        reminder_time = datetime.combine(current_time.date(), reminder.time)
        reminder_time = timezone.make_aware(reminder_time)
        
        time_diff = abs((current_time - reminder_time).total_seconds())
        
        if time_diff > 300:
            return False
        
        if reminder.frequency == 'daily':
            return True
        elif reminder.frequency == 'weekly':
            return current_weekday in reminder.weekdays
        elif reminder.frequency == 'custom':
            return current_weekday in reminder.weekdays
        
        return False

    def has_taken_medication_today(self, reminder, current_date):
        taken_today = MedicationIntake.objects.filter(
            user=reminder.user,
            drug=reminder.drug,
            taken_at__date=current_date,
            is_deleted=False
        ).exists()
        
        return taken_today

    def send_reminder_notification(self, reminder):
        try:
            reminder_data = {
                'medication_name': reminder.drug.name,
                'scheduled_time': reminder.time.strftime('%H:%M'),
                'amount': str(reminder.amount),
                'unit': reminder.unit,
                'notes': reminder.notes,
                'reminder_id': str(reminder.id)
            }
            
            success = self.publisher.publish_medication_reminder(
                user_id=reminder.user.id,
                reminder_data=reminder_data
            )
            
            if success:
                logger.info(f"Sent reminder for {reminder.drug.name} to user {reminder.user.email}")
            else:
                logger.warning(f"Failed to send reminder for {reminder.drug.name} to user {reminder.user.email}")
                
        except Exception as e:
            logger.error(f"Error sending reminder notification: {e}")

    def check_missed_medications(self):
        current_time = timezone.now()
        current_date = current_time.date()
        missed_threshold = current_time - timedelta(hours=2)
        
        logger.info(f"Checking for missed medications before {missed_threshold}")
        
        missed_reminders = MedicationReminder.objects.filter(
            is_active=True,
            start_date__lte=current_date
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=current_date)
        )
        
        missed_count = 0
        
        for reminder in missed_reminders:
            if self.is_medication_missed(reminder, missed_threshold):
                self.send_missed_notification(reminder, missed_threshold)
                missed_count += 1
        
        logger.info(f"Found {missed_count} missed medications")
        return missed_count

    def is_medication_missed(self, reminder, threshold_time):
        current_date = threshold_time.date()
        
        if not self.has_taken_medication_today(reminder, current_date):
            reminder_datetime = datetime.combine(current_date, reminder.time)
            reminder_datetime = timezone.make_aware(reminder_datetime)
            
            if reminder_datetime < threshold_time:
                current_weekday = current_date.strftime('%A').lower()
                return self.should_send_reminder(reminder, reminder_datetime, current_weekday)
        
        return False

    def send_missed_notification(self, reminder, threshold_time):
        try:
            missed_duration = threshold_time - datetime.combine(
                threshold_time.date(), reminder.time
            )
            
            reminder_data = {
                'medication_name': reminder.drug.name,
                'scheduled_time': reminder.time.strftime('%H:%M'),
                'amount': str(reminder.amount),
                'unit': reminder.unit,
                'notes': reminder.notes,
                'reminder_id': str(reminder.id),
                'missed_duration': str(missed_duration)
            }
            
            success = self.publisher.publish_medication_missed(
                user_id=reminder.user.id,
                reminder_data=reminder_data
            )
            
            if success:
                logger.info(f"Sent missed medication alert for {reminder.drug.name} to user {reminder.user.email}")
            else:
                logger.warning(f"Failed to send missed medication alert for {reminder.drug.name}")
                
        except Exception as e:
            logger.error(f"Error sending missed medication notification: {e}")
