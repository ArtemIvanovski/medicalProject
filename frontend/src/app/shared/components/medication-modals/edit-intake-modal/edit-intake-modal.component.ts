import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MedicationService} from "../../../../core/services";
import {FavoriteDrug, MedicationIntake} from "../../../../core/models";

@Component({
    selector: 'app-edit-intake-modal',
    templateUrl: './edit-intake-modal.component.html',
    styleUrls: ['./edit-intake-modal.component.scss']
})
export class EditIntakeModalComponent implements OnChanges {
    @Input() show = false;
    @Input() intake: MedicationIntake | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();
    @Output() deleted = new EventEmitter<void>();

    intakeForm!: FormGroup;
    drugSearchResults: string[] = [];
    favoriteDrugs: FavoriteDrug[] = [];
    isSearching = false;
    isLoadingFavorites = false;
    showFavorites = false;
    isDeleting = false;

    unitOptions = [
        {value: 'pieces', label: 'штуки'},
        {value: 'ml', label: 'мл'},
        {value: 'mg', label: 'мг'},
        {value: 'drops', label: 'капли'},
        {value: 'other', label: 'другое'}
    ];

    constructor(
        private fb: FormBuilder,
        private medicationService: MedicationService
    ) {
        this.initForm();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['intake'] && this.intake) {
            this.loadIntakeData();
        }
        if (changes['show'] && this.show) {
            this.loadFavoriteDrugs();
        }
    }

    private initForm(): void {
        this.intakeForm = this.fb.group({
            drug_name: ['', Validators.required],
            drug_form: ['', Validators.required],
            taken_at: ['', Validators.required],
            amount: [1, [Validators.required, Validators.min(0.01)]],
            unit: ['pieces', Validators.required],
            notes: ['']
        });
    }

    private loadIntakeData(): void {
        if (!this.intake) return;

        const takenAt = new Date(this.intake.taken_at);
        const dateString = takenAt.toISOString().slice(0, 10);
        const timeString = takenAt.toTimeString().slice(0, 5);

        this.intakeForm.patchValue({
            drug_name: this.intake.drug_name,
            drug_form: this.intake.drug_form,
            taken_at: `${dateString}T${timeString}`,
            amount: this.intake.amount,
            unit: this.intake.unit,
            notes: this.intake.notes || ''
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
        if (this.intakeForm.invalid || !this.intake) return;

        const formData = this.intakeForm.value;
        const takenAtISO = new Date(formData.taken_at).toISOString();

        const intakeData = {
            ...formData,
            taken_at: takenAtISO
        };

        this.medicationService.updateMedicationIntake(this.intake.id, intakeData).subscribe({
            next: () => {
                this.saved.emit();
                this.onClose();
            },
            error: (error) => {
                console.error('Error updating intake:', error);
            }
        });
    }

    onDelete(): void {
        if (!this.intake || this.isDeleting) return;

        if (confirm('Вы уверены, что хотите удалить эту запись о приеме лекарства?')) {
            this.isDeleting = true;
            this.medicationService.deleteMedicationIntake(this.intake.id).subscribe({
                next: () => {
                    this.deleted.emit();
                    this.onClose();
                    this.isDeleting = false;
                },
                error: (error) => {
                    console.error('Error deleting intake:', error);
                    this.isDeleting = false;
                }
            });
        }
    }
}