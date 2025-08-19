import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {MedicationService} from '../../../core/services';
import {FavoriteDrug, MedicationIntake} from "../../../core/models";

@Component({
  selector: 'app-medication-favorites',
  templateUrl: './medication-favorites.component.html',
  styleUrls: ['./medication-favorites.component.scss']
})
export class MedicationFavoritesComponent implements OnInit {
  showAddIntakeModal = false;
  showEditIntakeModal = false;
  showCreateReminderModal = false;
  showCreatePatternModal = false;
  editingIntake: MedicationIntake | null = null;

  favorites: FavoriteDrug[] = [];
  searchResults: string[] = [];
  isLoading = false;
  isSearching = false;
  searchTerm = '';
  showAddForm = false;

  newFavorite = {
    drugName: '',
    drugForm: 'таблетки'
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

  constructor(
    private medicationService: MedicationService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Избранные лекарства');
    this.loadFavorites();
  }

  private loadFavorites(): void {
    this.isLoading = true;

    this.medicationService.getFavoriteDrugs().subscribe({
      next: (response) => {
        this.favorites = response.results;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading favorites:', error);
        this.isLoading = false;
      }
    });
  }

  searchDrugs(): void {
    if (this.searchTerm.length < 2) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;

    this.medicationService.searchDrugs(this.searchTerm).subscribe({
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

  selectDrugFromSearch(drugName: string): void {
    this.newFavorite.drugName = drugName;
    this.searchTerm = drugName;
    this.searchResults = [];
    this.showAddForm = true;
  }

  addToFavorites(): void {
    if (!this.newFavorite.drugName.trim()) return;

    const tempDrug = {
      id: Date.now().toString(),
      name: this.newFavorite.drugName,
      form: this.newFavorite.drugForm,
      description: ''
    };

    this.medicationService.addFavoriteDrug(tempDrug.id).subscribe({
      next: () => {
        this.loadFavorites();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error adding to favorites:', error);
      }
    });
  }

  removeFromFavorites(favorite: FavoriteDrug): void {
    if (confirm(`Удалить "${favorite.drug_name}" из избранного?`)) {
      this.medicationService.removeFavoriteDrug(favorite.drug).subscribe({
        next: () => {
          this.loadFavorites();
        },
        error: (error) => {
          console.error('Error removing favorite:', error);
        }
      });
    }
  }

  quickAddIntake(favorite: FavoriteDrug): void {
    console.log('Quick add intake for:', favorite);
  }

  resetForm(): void {
    this.newFavorite = {
      drugName: '',
      drugForm: 'таблетки'
    };
    this.searchTerm = '';
    this.searchResults = [];
    this.showAddForm = false;
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
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
    this.loadFavorites();
  }

  onReminderSaved(): void {
    this.loadFavorites();
  }

  onPatternSaved(): void {
    this.loadFavorites();
  }
}