import time
from django.core.management.base import BaseCommand
from apps.drug_search.reminder_service import MedicationReminderService


class Command(BaseCommand):
    help = 'Check and send medication reminders'

    def add_arguments(self, parser):
        parser.add_argument(
            '--continuous',
            action='store_true',
            help='Run continuously checking every 5 minutes',
        )
        parser.add_argument(
            '--check-missed',
            action='store_true',
            help='Also check for missed medications',
        )

    def handle(self, *args, **options):
        service = MedicationReminderService()
        
        if options['continuous']:
            self.stdout.write('Starting continuous medication reminder service...')
            try:
                while True:
                    service.check_and_send_reminders()
                    
                    if options['check_missed']:
                        service.check_missed_medications()
                    
                    time.sleep(300)
                    
            except KeyboardInterrupt:
                self.stdout.write('Stopping medication reminder service...')
        else:
            self.stdout.write('Checking medication reminders once...')
            reminders_sent = service.check_and_send_reminders()
            
            if options['check_missed']:
                missed_count = service.check_missed_medications()
                self.stdout.write(f'Found {missed_count} missed medications')
            
            self.stdout.write(f'Sent {reminders_sent} reminders')
