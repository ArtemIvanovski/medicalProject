import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MedicationService } from "../../../../core/services";

interface PatternItem {
  drug_name: string;
  drug_form: string;
  amount: number;
  unit: string;
  notes: string;
}

@Component({
  selector: 'app-create-pattern-modal',
  templateUrl: './create-pattern-modal.component.html',
  styleUrls: ['./create-pattern-modal.component.scss']
})
export class CreatePatternModalComponent {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  patternForm!: FormGroup;
  drugSearchResults: string[] = [];
  isSearching = false;
  activeSearchIndex = -1;

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

  private initForm(): void {
    this.patternForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      items: this.fb.array([this.createPatternItem()])
    });
  }

  private createPatternItem(): FormGroup {
    return this.fb.group({
      drug_name: ['', Validators.required],
      drug_form: ['', Validators.required],
      amount: [1, [Validators.required, Validators.min(0.01)]],
      unit: ['pieces', Validators.required],
      notes: ['']
    });
  }

  get itemsArray(): FormArray {
    return this.patternForm.get('items') as FormArray;
  }

  onShow(): void {
    this.patternForm.reset();
    const itemsArray = this.itemsArray;
    while (itemsArray.length > 1) {
      itemsArray.removeAt(1);
    }
    this.patternForm.patchValue({
      name: '',
      description: ''
    });
    this.drugSearchResults = [];
    this.activeSearchIndex = -1;
  }

  addItem(): void {
    this.itemsArray.push(this.createPatternItem());
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  onDrugSearch(event: any, index: number): void {
    const query = event.target.value;
    this.activeSearchIndex = index;

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
    if (this.activeSearchIndex >= 0) {
      const item = this.itemsArray.at(this.activeSearchIndex);
      item.patchValue({
        drug_name: drugName,
        drug_form: 'таблетки'
      });
      this.drugSearchResults = [];
      this.activeSearchIndex = -1;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    if (this.patternForm.invalid) return;

    const formData = this.patternForm.value;

    this.medicationService.createMedicationPattern(formData).subscribe({
      next: () => {
        this.saved.emit();
        this.onClose();
      },
      error: (error) => {
        console.error('Error creating pattern:', error);
      }
    });
  }
}