import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  FavoriteDrug, MedicationIntake,
  MedicationService
} from "../../../../core/services";

@Component({
  selector: 'app-add-intake-modal',
  templateUrl: './add-intake-modal.component.html',
  styleUrls: ['./add-intake-modal.component.scss']
})
export class AddIntakeModalComponent implements OnInit {
  @Input() show = false;
  @Input() editingIntake: MedicationIntake | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  intakeForm!: FormGroup;
  drugSearchResults: string[] = [];
  favoriteDrugs: FavoriteDrug[] = [];
  isSearching = false;
  isLoadingFavorites = false;
  showFavorites = false;

  unitOptions = [
    { value: 'pieces', label: 'штуки' },
    { value: 'ml', label: 'мл' },
    { value: 'mg', label: 'мг' },
    { value: 'drops', label: 'капли' },
    { value: 'other', label: 'другое' }
  ];

  constructor(
      private fb: FormBuilder,
      private medicationService: MedicationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadFavoriteDrugs();
  }

  private initForm(): void {
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5);
    const dateString = now.toISOString().slice(0, 10);

    this.intakeForm = this.fb.group({
      drug_name: ['', Validators.required],
      drug_form: ['', Validators.required],
      taken_at: [`${dateString}T${timeString}`, Validators.required],
      amount: [1, [Validators.required, Validators.min(0.01)]],
      unit: ['pieces', Validators.required],
      notes: ['']
    });
  }

  private loadFavoriteDrugs(): void {
    this.isLoadingFavorites = true;
    this.medicationService.getFavoriteDrugs().subscribe({
      next: (response) => {
        this.favoriteDrugs = response.results;
        this.isLoadingFavorites = false;
      },
      error: (error) => {
        console.error('Error loading favorites:', error);
        this.isLoadingFavorites = false;
      }
    });
  }

  onShow(): void {
    if (this.editingIntake) {
      const takenAt = new Date(this.editingIntake.taken_at);
      const dateString = takenAt.toISOString().slice(0, 10);
      const timeString = takenAt.toTimeString().slice(0, 5);

      this.intakeForm.patchValue({
        drug_name: this.editingIntake.drug_name,
        drug_form: this.editingIntake.drug_form,
        taken_at: `${dateString}T${timeString}`,
        amount: this.editingIntake.amount,
        unit: this.editingIntake.unit,
        notes: this.editingIntake.notes || ''
      });
    } else {
      this.intakeForm.reset();
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 5);
      const dateString = now.toISOString().slice(0, 10);

      this.intakeForm.patchValue({
        drug_name: '',
        drug_form: '',
        taken_at: `${dateString}T${timeString}`,
        amount: 1,
        unit: 'pieces',
        notes: ''
      });
    }
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

  selectDrug(drugName: string, drugForm?: string): void {
    this.intakeForm.patchValue({
      drug_name: drugName,
      drug_form: drugForm || 'таблетки'
    });
    this.drugSearchResults = [];
    this.showFavorites = false;
  }

  selectFavoriteDrug(favorite: FavoriteDrug): void {
    this.selectDrug(favorite.drug_name, favorite.drug_form);
  }

  toggleFavorites(): void {
    this.showFavorites = !this.showFavorites;
    this.drugSearchResults = [];
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    if (this.intakeForm.invalid) return;

    const formData = this.intakeForm.value;
    const takenAtISO = new Date(formData.taken_at).toISOString();

    const intakeData = {
      ...formData,
      taken_at: takenAtISO
    };

    if (this.editingIntake) {
      this.medicationService.updateMedicationIntake(this.editingIntake.id, intakeData).subscribe({
        next: () => {
          this.saved.emit();
          this.onClose();
        },
        error: (error) => {
          console.error('Error updating intake:', error);
        }
      });
    } else {
      this.medicationService.createMedicationIntake(intakeData).subscribe({
        next: () => {
          this.saved.emit();
          this.onClose();
        },
        error: (error) => {
          console.error('Error creating intake:', error);
        }
      });
    }
  }
}