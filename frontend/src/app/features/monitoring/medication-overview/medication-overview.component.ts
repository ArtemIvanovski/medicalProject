import { Component, OnInit } from '@angular/core';
import {
  MedicationIntake,
  MedicationPattern,
  MedicationReminder,
  MedicationService,
  MedicationStats
} from "../../../core/services";
import {Title} from "@angular/platform-browser";

@Component({
  selector: 'app-medication-overview',
  templateUrl: './medication-overview.component.html',
  styleUrls: ['./medication-overview.component.scss']
})
export class MedicationOverviewComponent implements OnInit {
  showAddIntakeModal = false;
  showEditIntakeModal = false;
  showCreateReminderModal = false;
  showCreatePatternModal = false;
  editingIntake: MedicationIntake | null = null;

  recentIntakes: MedicationIntake[] = [];
  todayReminders: MedicationReminder[] = [];
  quickPatterns: MedicationPattern[] = [];
  weeklyStats: MedicationStats[] = [];
  isLoading = false;

  constructor(private medicationService: MedicationService,  private titleService: Title) {}

  ngOnInit(): void {
    this.titleService.setTitle('Мониторинг лекарственной терапии');
    this.loadOverviewData();
  }

  private loadOverviewData(): void {
    this.isLoading = true;

    this.medicationService.getMedicationIntakes().subscribe({
      next: (response) => {
        this.recentIntakes = response.results.slice(0, 5);
      },
      error: (error) => console.error('Error loading recent intakes:', error)
    });

    this.medicationService.getActiveRemindersToday().subscribe({
      next: (response) => {
        this.todayReminders = response.reminders;
      },
      error: (error) => console.error('Error loading reminders:', error)
    });

    this.medicationService.getMedicationPatterns().subscribe({
      next: (response) => {
        this.quickPatterns = response.results.filter(p => p.is_active).slice(0, 4);
      },
      error: (error) => console.error('Error loading patterns:', error)
    });

    this.medicationService.getMedicationStats(7).subscribe({
      next: (response) => {
        this.weeklyStats = response.stats.slice(0, 3);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
        this.isLoading = false;
      }
    });
  }

  applyQuickPattern(patternId: string, patternName: string): void {
    const now = new Date().toISOString();

    this.medicationService.applyMedicationPattern(patternId, now).subscribe({
      next: (response) => {
        console.log(`Применен шаблон "${patternName}". Создано записей: ${response.intakes_created}`);
        this.loadOverviewData();
      },
      error: (error) => console.error('Error applying pattern:', error)
    });
  }

  openAddIntakeModal(): void {
    this.editingIntake = null;
    this.showAddIntakeModal = true;
  }

  openEditIntakeModal(intake: MedicationIntake): void {
    this.editingIntake = intake;
    this.showEditIntakeModal = true;
  }

  openCreateReminderModal(): void {
    this.showCreateReminderModal = true;
  }

  openCreatePatternModal(): void {
    this.showCreatePatternModal = true;
  }

  closeAddIntakeModal(): void {
    this.showAddIntakeModal = false;
    this.editingIntake = null;
  }

  closeEditIntakeModal(): void {
    this.showEditIntakeModal = false;
    this.editingIntake = null;
  }

  closeCreateReminderModal(): void {
    this.showCreateReminderModal = false;
  }

  closeCreatePatternModal(): void {
    this.showCreatePatternModal = false;
  }

  onIntakeSaved(): void {
    this.loadOverviewData();
  }

  onReminderSaved(): void {
    this.loadOverviewData();
  }

  onPatternSaved(): void {
    this.loadOverviewData();
  }
}