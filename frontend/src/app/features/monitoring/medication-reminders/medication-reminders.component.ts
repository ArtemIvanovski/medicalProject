import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MedicationIntake,
  MedicationReminder,
  MedicationService
} from "../../../core/services";

interface ReminderTab {
  id: string;
  label: string;
  count: number;
}

@Component({
  selector: 'app-medication-reminders',
  templateUrl: './medication-reminders.component.html',
  styleUrls: ['./medication-reminders.component.scss']
})
export class MedicationRemindersComponent implements OnInit {
  showAddIntakeModal = false;
  showEditIntakeModal = false;
  showCreateReminderModal = false;
  showCreatePatternModal = false;
  editingIntake: MedicationIntake | null = null;

  reminders: MedicationReminder[] = [];
  filteredReminders: MedicationReminder[] = [];
  isLoading = false;
  activeTab = 'active';
  showCreateModal = false;
  editingReminder: MedicationReminder | null = null;
  reminderForm!: FormGroup;
  drugSearchResults: string[] = [];
  isSearching = false;

  tabs: ReminderTab[] = [
    { id: 'active', label: 'Активные', count: 0 },
    { id: 'inactive', label: 'Неактивные', count: 0 },
    { id: 'all', label: 'Все', count: 0 }
  ];

  frequencyOptions = [
    { value: 'daily', label: 'Ежедневно' },
    { value: 'weekly', label: 'Еженедельно' },
    { value: 'custom', label: 'По дням недели' }
  ];

  unitOptions = [
    { value: 'pieces', label: 'штуки' },
    { value: 'ml', label: 'мл' },
    { value: 'mg', label: 'мг' },
    { value: 'drops', label: 'капли' },
    { value: 'other', label: 'другое' }
  ];

  weekdays = [
    { value: 'monday', label: 'Пн' },
    { value: 'tuesday', label: 'Вт' },
    { value: 'wednesday', label: 'Ср' },
    { value: 'thursday', label: 'Чт' },
    { value: 'friday', label: 'Пт' },
    { value: 'saturday', label: 'Сб' },
    { value: 'sunday', label: 'Вс' }
  ];

  constructor(
      private medicationService: MedicationService,
      private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadReminders();
  }

  private initForm(): void {
    this.reminderForm = this.fb.group({
      drug_name: ['', Validators.required],
      drug_form: ['', Validators.required],
      title: ['', Validators.required],
      amount: [1, [Validators.required, Validators.min(0.01)]],
      unit: ['pieces', Validators.required],
      frequency: ['daily', Validators.required],
      time: ['', Validators.required],
      weekdays: [[]],
      start_date: ['', Validators.required],
      end_date: [''],
      notes: ['']
    });
  }

  private loadReminders(): void {
    this.isLoading = true;
    this.medicationService.getMedicationReminders().subscribe({
      next: (response) => {
        this.reminders = response.results;
        this.updateTabCounts();
        this.filterReminders();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading reminders:', error);
        this.isLoading = false;
      }
    });
  }

  private updateTabCounts(): void {
    this.tabs[0].count = this.reminders.filter(r => r.is_active).length;
    this.tabs[1].count = this.reminders.filter(r => !r.is_active).length;
    this.tabs[2].count = this.reminders.length;
  }

  switchTab(tabId: string): void {
    this.activeTab = tabId;
    this.filterReminders();
  }

  private filterReminders(): void {
    switch (this.activeTab) {
      case 'active':
        this.filteredReminders = this.reminders.filter(r => r.is_active);
        break;
      case 'inactive':
        this.filteredReminders = this.reminders.filter(r => !r.is_active);
        break;
      default:
        this.filteredReminders = this.reminders;
    }
  }

  openCreateModal(): void {
    this.editingReminder = null;
    this.reminderForm.reset({
      drug_name: '',
      drug_form: '',
      title: '',
      amount: 1,
      unit: 'pieces',
      frequency: 'daily',
      time: '',
      weekdays: [],
      start_date: '',
      end_date: '',
      notes: ''
    });
    this.showCreateModal = true;
  }

  openEditModal(reminder: MedicationReminder): void {
    this.editingReminder = reminder;
    this.reminderForm.patchValue({
      drug_name: reminder.drug_name,
      drug_form: reminder.drug_form,
      title: reminder.title,
      amount: reminder.amount,
      unit: reminder.unit,
      frequency: reminder.frequency,
      time: reminder.time,
      weekdays: reminder.weekdays || [],
      start_date: reminder.start_date,
      end_date: reminder.end_date || '',
      notes: reminder.notes || ''
    });
    this.showCreateModal = true;
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.editingReminder = null;
    this.drugSearchResults = [];
  }

  onDrugSearch(event: any): void {
    const query = event.target.value;
    if (query.length < 2) {
      this.drugSearchResults = [];
      return;
    }

    this.isSearching = true;
    this.medicationService.searchDrugs(query).subscribe({
      next: (response) => {
        this.drugSearchResults = response.results;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Error searching drugs:', error);
        this.isSearching = false;
      }
    });
  }

  selectDrug(drugName: string): void {
    this.reminderForm.patchValue({
      drug_name: drugName,
      drug_form: 'таблетки'
    });
    this.drugSearchResults = [];
  }

  onFrequencyChange(): void {
    const frequency = this.reminderForm.get('frequency')?.value;
    if (frequency !== 'custom') {
      this.reminderForm.patchValue({ weekdays: [] });
    }
  }

  toggleWeekday(weekday: string): void {
    const weekdays = this.reminderForm.get('weekdays')?.value || [];
    const index = weekdays.indexOf(weekday);

    if (index > -1) {
      weekdays.splice(index, 1);
    } else {
      weekdays.push(weekday);
    }

    this.reminderForm.patchValue({ weekdays });
  }

  isWeekdaySelected(weekday: string): boolean {
    const weekdays = this.reminderForm.get('weekdays')?.value || [];
    return weekdays.includes(weekday);
  }

  saveReminder(): void {
    if (this.reminderForm.invalid) return;

    const formData = this.reminderForm.value;

    this.medicationService.createMedicationReminder(formData).subscribe({
      next: () => {
        this.closeModal();
        this.loadReminders();
      },
      error: (error) => {
        console.error('Error saving reminder:', error);
      }
    });
  }

  getFrequencyLabel(frequency: string): string {
    const option = this.frequencyOptions.find(opt => opt.value === frequency);
    return option ? option.label : frequency;
  }

  getUnitLabel(unit: string): string {
    const option = this.unitOptions.find(opt => opt.value === unit);
    return option ? option.label : unit;
  }

  formatWeekdays(weekdays: string[]): string {
    if (!weekdays || weekdays.length === 0) return '';
    const dayLabels = weekdays.map(day => {
      const weekday = this.weekdays.find(w => w.value === day);
      return weekday ? weekday.label : day;
    });
    return dayLabels.join(', ');
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
    this.loadReminders();
  }

  onReminderSaved(): void {
    this.loadReminders();
  }

  onPatternSaved(): void {
    this.loadReminders();
  }
}