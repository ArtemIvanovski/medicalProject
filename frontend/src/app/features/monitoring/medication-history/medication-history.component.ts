import { Component, OnInit } from '@angular/core';
import {MedicationIntake, MedicationService} from "../../../core/services";

@Component({
  selector: 'app-medication-history',
  templateUrl: './medication-history.component.html',
  styleUrls: ['./medication-history.component.scss']
})
export class MedicationHistoryComponent implements OnInit {
  showAddIntakeModal = false;
  showEditIntakeModal = false;
  showDeleteModal = false; // Новая переменная для модалки удаления
  showCreateReminderModal = false;
  showCreatePatternModal = false;
  editingIntake: MedicationIntake | null = null;
  selectedIntakeForDelete: MedicationIntake | null = null; // Запись для удаления
  intakes: MedicationIntake[] = [];
  filteredIntakes: MedicationIntake[] = [];
  isLoading = false;
  Math = Math;
  searchTerm = '';
  selectedPeriod = '30';
  selectedDrug = '';
  sortBy = 'taken_at';
  sortOrder = 'desc';

  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  uniqueDrugs: string[] = [];

  constructor(private medicationService: MedicationService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  private loadHistory(): void {
    this.isLoading = true;

    this.medicationService.getMedicationIntakes().subscribe({
      next: (response) => {
        this.intakes = response.results;
        this.extractUniqueDrugs();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading history:', error);
        this.isLoading = false;
      }
    });
  }

  private extractUniqueDrugs(): void {
    const drugNames = this.intakes.map(intake => intake.drug_name);
    this.uniqueDrugs = [...new Set(drugNames)].sort();
  }

  applyFilters(): void {
    let filtered = [...this.intakes];

    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(intake =>
          intake.drug_name.toLowerCase().includes(search) ||
          intake.notes.toLowerCase().includes(search)
      );
    }

    if (this.selectedDrug) {
      filtered = filtered.filter(intake => intake.drug_name === this.selectedDrug);
    }

    if (this.selectedPeriod !== 'all') {
      const days = parseInt(this.selectedPeriod);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      filtered = filtered.filter(intake =>
          new Date(intake.taken_at) >= cutoffDate
      );
    }

    filtered.sort((a, b) => {
      const aValue = this.sortBy === 'taken_at' ? new Date(a.taken_at).getTime() : a.drug_name;
      const bValue = this.sortBy === 'taken_at' ? new Date(b.taken_at).getTime() : b.drug_name;

      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    this.filteredIntakes = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
  }

  get paginatedIntakes(): MedicationIntake[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredIntakes.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get pages(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedDrug = '';
    this.selectedPeriod = '30';
    this.applyFilters();
  }

  openDeleteModal(intake: MedicationIntake): void {
    this.selectedIntakeForDelete = intake;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedIntakeForDelete = null;
  }

  confirmDelete(): void {
    if (this.selectedIntakeForDelete) {
      this.medicationService.deleteMedicationIntake(this.selectedIntakeForDelete.id).subscribe({
        next: () => {
          this.closeDeleteModal();
          this.loadHistory();
        },
        error: (error) => {
          console.error('Error deleting intake:', error);
          this.closeDeleteModal();
        }
      });
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
    this.loadHistory();
  }

  onReminderSaved(): void {
    this.loadHistory();
  }

  onPatternSaved(): void {
    this.loadHistory();
  }
}