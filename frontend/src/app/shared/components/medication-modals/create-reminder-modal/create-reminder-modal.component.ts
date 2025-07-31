import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MedicationService } from "../../../../core/services";

@Component({
  selector: 'app-create-reminder-modal',
  templateUrl: './create-reminder-modal.component.html',
  styleUrls: ['./create-reminder-modal.component.scss']
})
export class CreateReminderModalComponent {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  reminderForm!: FormGroup;
  drugSearchResults: string[] = [];
  isSearching = false;

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
      private fb: FormBuilder,
      private medicationService: MedicationService
  ) {
    this.initForm();
  }

  private initForm(): void {
    const today = new Date().toISOString().split('T')[0];

    this.reminderForm = this.fb.group({
      drug_name: ['', Validators.required],
      drug_form: ['', Validators.required],
      title: ['', Validators.required],
      amount: [1, [Validators.required, Validators.min(0.01)]],
      unit: ['pieces', Validators.required],
      frequency: ['daily', Validators.required],
      time: ['', Validators.required],
      weekdays: [[]],
      start_date: [today, Validators.required],
      end_date: [''],
      notes: ['']
    });
  }

  onShow(): void {
    const today = new Date().toISOString().split('T')[0];
    this.reminderForm.reset({
      drug_name: '',
      drug_form: '',
      title: '',
      amount: 1,
      unit: 'pieces',
      frequency: 'daily',
      time: '',
      weekdays: [],
      start_date: today,
      end_date: '',
      notes: ''
    });
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
      drug_form: 'таблетки',
      title: `Прием ${drugName}`
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

  isFormValid(): boolean {
    const form = this.reminderForm;
    const frequency = form.get('frequency')?.value;

    if (!form.valid) return false;

    if (frequency === 'custom') {
      const weekdays = form.get('weekdays')?.value || [];
      return weekdays.length > 0;
    }

    return true;
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    if (!this.isFormValid()) return;

    const formData = this.reminderForm.value;

    this.medicationService.createMedicationReminder(formData).subscribe({
      next: () => {
        this.saved.emit();
        this.onClose();
      },
      error: (error) => {
        console.error('Error creating reminder:', error);
      }
    });
  }
}