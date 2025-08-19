import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {MedicationService} from '../../../core/services';
import {MedicationIntake, MedicationPattern} from "../../../core/models";

@Component({
  selector: 'app-medication-patterns',
  templateUrl: './medication-patterns.component.html',
  styleUrls: ['./medication-patterns.component.scss']
})
export class MedicationPatternsComponent implements OnInit {
  showAddIntakeModal = false;
  showEditIntakeModal = false;
  showCreateReminderModal = false;
  showCreatePatternModal = false;
  editingIntake: MedicationIntake | null = null;

  patterns: MedicationPattern[] = [];
  searchResults: string[] = [];
  isLoading = false;
  isSearching = false;
  showCreateForm = false;
  editingPattern: MedicationPattern | null = null;

  newPattern = {
    name: '',
    description: '',
    items: [
      {
        drug_name: '',
        drug_form: 'таблетки',
        amount: 1,
        unit: 'pieces',
        notes: ''
      }
    ]
  };

  drugForms = [
    'таблетки',
    'капсулы',
    'ампулы',
    'раствор',
    'сироп',
    'мазь',
    'капли',
    'спрей',
    'порошок',
    'свечи'
  ];

  units = [
    { value: 'pieces', label: 'штуки' },
    { value: 'ml', label: 'мл' },
    { value: 'mg', label: 'мг' },
    { value: 'drops', label: 'капли' },
    { value: 'other', label: 'другое' }
  ];

  applyPatternData = {
    patternId: '',
    takenAt: new Date().toISOString().slice(0, 16)
  };

  searchTerms: string[] = [];

  constructor(
    private medicationService: MedicationService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Паттерны приема');
    this.loadPatterns();
    this.initializeSearchTerms();
  }

  private loadPatterns(): void {
    this.isLoading = true;

    this.medicationService.getMedicationPatterns().subscribe({
      next: (response) => {
        this.patterns = response.results;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading patterns:', error);
        this.isLoading = false;
      }
    });
  }

  private initializeSearchTerms(): void {
    this.searchTerms = Array(this.newPattern.items.length).fill('');
  }

  searchDrugs(query: string, index: number): void {
    if (query.length < 2) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;

    this.medicationService.searchDrugs(query).subscribe({
      next: (response) => {
        this.searchResults = response.results;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Error searching drugs:', error);
        this.isSearching = false;
      }
    });
  }

  selectDrugFromSearch(drugName: string, index: number): void {
    this.newPattern.items[index].drug_name = drugName;
    this.searchTerms[index] = drugName;
    this.searchResults = [];
  }

  addPatternItem(): void {
    this.newPattern.items.push({
      drug_name: '',
      drug_form: 'таблетки',
      amount: 1,
      unit: 'pieces',
      notes: ''
    });
    this.searchTerms.push('');
  }

  removePatternItem(index: number): void {
    if (this.newPattern.items.length > 1) {
      this.newPattern.items.splice(index, 1);
      this.searchTerms.splice(index, 1);
    }
  }

  createPattern(): void {
    if (!this.newPattern.name.trim() || this.newPattern.items.some(item => !item.drug_name.trim())) {
      return;
    }

    const patternData = {
      name: this.newPattern.name,
      description: this.newPattern.description,
      items: this.newPattern.items.map((item, index) => ({
        drug_name: item.drug_name,
        drug_form: item.drug_form,
        amount: item.amount,
        unit: item.unit,
        notes: item.notes,
        order: index
      }))
    };

    this.medicationService.createMedicationPattern(patternData).subscribe({
      next: () => {
        this.loadPatterns();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error creating pattern:', error);
      }
    });
  }

  applyPattern(pattern: MedicationPattern): void {
    this.applyPatternData.patternId = pattern.id;

    const takenAt = new Date(this.applyPatternData.takenAt).toISOString();

    this.medicationService.applyMedicationPattern(pattern.id, takenAt).subscribe({
      next: (response) => {
        console.log(`Шаблон "${pattern.name}" применен. Создано записей: ${response.intakes_created}`);
        this.applyPatternData.patternId = '';
      },
      error: (error) => {
        console.error('Error applying pattern:', error);
      }
    });
  }

  editPattern(pattern: MedicationPattern): void {
    this.editingPattern = pattern;
    this.newPattern = {
      name: pattern.name,
      description: pattern.description,
      items: pattern.items.map(item => ({
        drug_name: item.drug_name,
        drug_form: item.drug_form,
        amount: item.amount,
        unit: item.unit,
        notes: item.notes
      }))
    };
    this.searchTerms = pattern.items.map(item => item.drug_name);
    this.showCreateForm = true;
  }

  deletePattern(pattern: MedicationPattern): void {
    if (confirm(`Удалить шаблон "${pattern.name}"?`)) {
      console.log('Delete pattern:', pattern.id);
      this.loadPatterns();
    }
  }

  resetForm(): void {
    this.newPattern = {
      name: '',
      description: '',
      items: [
        {
          drug_name: '',
          drug_form: 'таблетки',
          amount: 1,
          unit: 'pieces',
          notes: ''
        }
      ]
    };
    this.searchTerms = [''];
    this.searchResults = [];
    this.showCreateForm = false;
    this.editingPattern = null;
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.resetForm();
    }
  }

  isFormValid(): boolean {
    return this.newPattern.name.trim() !== '' &&
        this.newPattern.items.every(item => item.drug_name.trim() !== '' && item.amount > 0);
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
    this.loadPatterns();
  }

  onReminderSaved(): void {
    this.loadPatterns();
  }

  onPatternSaved(): void {
    this.loadPatterns();
  }
}