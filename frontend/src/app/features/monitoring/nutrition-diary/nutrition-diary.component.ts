import { Component, OnInit, HostListener } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NutritionService } from '../../../core/services';
import { FoodIntake, NutritionStats, DailyGoal } from '../../../core/models';

@Component({
    selector: 'app-nutrition-diary',
    templateUrl: './nutrition-diary.component.html',
    styleUrls: ['./nutrition-diary.component.scss']
})
export class NutritionDiaryComponent implements OnInit {
    selectedDate = new Date();
    foodIntakes: FoodIntake[] = [];
    dailyStats: NutritionStats | null = null;
    dailyGoal: DailyGoal | null = null;
    originalDailyGoal: DailyGoal | null = null;
    
    isLoading = false;
    error = '';
    
    // Period selection
    selectedPeriod: 'day' | 'week' = 'day';
    weekStats: NutritionStats[] = [];
    
    // Edit modal
    showEditModal = false;
    editForm: FormGroup;
    selectedIntake: FoodIntake | null = null;
    
    constructor(
        private nutritionService: NutritionService,
        private titleService: Title,
        private fb: FormBuilder
    ) {
        this.editForm = this.fb.group({
            amount: [100, [Validators.required, Validators.min(1)]],
            unit: ['g', Validators.required],
            consumed_at: ['', Validators.required],
            notes: ['']
        });
    }

    ngOnInit(): void {
        this.titleService.setTitle('Дневник питания');
        this.loadDiary();
        this.loadDailyGoal();
    }

    loadDiary(): void {
        this.isLoading = true;
        
        if (this.selectedPeriod === 'day') {
            this.loadDayDiary();
        } else {
            this.loadWeekDiary();
        }
    }

    private loadDayDiary(): void {
        const dateStr = this.formatDate(this.selectedDate);
        
        this.nutritionService.getFoodIntakes(dateStr).subscribe({
            next: (response) => {
                this.foodIntakes = response.results || [];
                this.currentPage = 1;
                this.updatePagination();
                this.loadStats();
            },
            error: (error) => {
                this.error = 'Ошибка загрузки дневника питания';
                this.isLoading = false;
                console.error('Diary error:', error);
            }
        });
    }

    private loadWeekDiary(): void {
        const weekDates = this.getWeekDates(this.selectedDate);
        const intakeObservables = weekDates.map(date => 
            this.nutritionService.getFoodIntakes(this.formatDate(date))
        );

        forkJoin(intakeObservables).subscribe({
            next: (results: any[]) => {
                // Combine all intakes from the week
                this.foodIntakes = [];
                results.forEach(response => {
                    if (response.results) {
                        this.foodIntakes = this.foodIntakes.concat(response.results);
                    }
                });
                
                // Sort by consumed_at date (newest first)
                this.foodIntakes.sort((a, b) => {
                    return new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime();
                });
                
                this.currentPage = 1;
                this.updatePagination();
                this.loadStats();
            },
            error: (error) => {
                this.error = 'Ошибка загрузки недельного дневника питания';
                this.isLoading = false;
                console.error('Week diary error:', error);
            }
        });
    }

    loadStats(): void {
        if (this.selectedPeriod === 'day') {
            this.loadDailyStats();
        } else {
            this.loadWeekStats();
        }
    }

    loadDailyStats(): void {
        const dateStr = this.formatDate(this.selectedDate);
        
        this.nutritionService.getDailyStats(dateStr).subscribe({
            next: (response: any) => {
                // Map API response to expected format
                this.dailyStats = {
                    calories: parseFloat(response.total_calories) || 0,
                    protein: parseFloat(response.total_protein) || 0,
                    fat: parseFloat(response.total_fat) || 0,
                    carbohydrate: parseFloat(response.total_carbohydrate) || 0
                };
                this.isLoading = false;
                this.updateCaloriesCircle();
            },
            error: (error) => {
                this.error = 'Ошибка загрузки статистики';
                this.isLoading = false;
                console.error('Stats error:', error);
            }
        });
    }

    loadWeekStats(): void {
        // For week stats, we'll load stats for each day of the week
        const weekDates = this.getWeekDates(this.selectedDate);
        const statsObservables = weekDates.map(date => 
            this.nutritionService.getDailyStats(this.formatDate(date))
        );

        forkJoin(statsObservables).subscribe({
            next: (results: any[]) => {
                // Map each result and store in weekStats
                this.weekStats = results.map((response: any) => ({
                    calories: parseFloat(response.total_calories) || 0,
                    protein: parseFloat(response.total_protein) || 0,
                    fat: parseFloat(response.total_fat) || 0,
                    carbohydrate: parseFloat(response.total_carbohydrate) || 0
                }));
                
                // Calculate total for the week
                this.dailyStats = {
                    calories: this.weekStats.reduce((sum, stat) => sum + (stat.calories || 0), 0),
                    protein: this.weekStats.reduce((sum, stat) => sum + (stat.protein || 0), 0),
                    fat: this.weekStats.reduce((sum, stat) => sum + (stat.fat || 0), 0),
                    carbohydrate: this.weekStats.reduce((sum, stat) => sum + (stat.carbohydrate || 0), 0)
                };
                
                // For week view, multiply daily goals by 7
                if (this.originalDailyGoal) {
                    this.dailyGoal = {
                        ...this.originalDailyGoal,
                        calories_goal: this.originalDailyGoal.calories_goal * 7,
                        protein_goal: this.originalDailyGoal.protein_goal * 7,
                        fat_goal: this.originalDailyGoal.fat_goal * 7,
                        carbohydrate_goal: this.originalDailyGoal.carbohydrate_goal * 7
                    };
                }
                
                this.isLoading = false;
                this.updateCaloriesCircle();
            },
            error: (error) => {
                this.error = 'Ошибка загрузки недельной статистики';
                this.isLoading = false;
                console.error('Week stats error:', error);
            }
        });
    }

    loadDailyGoal(): void {
        this.nutritionService.getDailyGoal().subscribe({
            next: (goal) => {
                this.originalDailyGoal = goal;
                this.dailyGoal = { ...goal }; // Create a copy
            },
            error: (error) => {
                console.error('Daily goal error:', error);
            }
        });
    }

    onDateChange(event: any): void {
        this.selectedDate = new Date(event.target.value);
        this.loadDiary();
    }

    onPeriodChange(period: 'day' | 'week'): void {
        this.selectedPeriod = period;
        
        // Reset goals to original values before applying period multiplier
        if (this.originalDailyGoal) {
            this.dailyGoal = { ...this.originalDailyGoal };
        }
        
        this.loadStats();
    }

    onPeriodSwitchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        const period = target.checked ? 'week' : 'day';
        this.onPeriodChange(period);
    }

    previousDate(): void {
        if (this.selectedPeriod === 'day') {
            this.selectedDate.setDate(this.selectedDate.getDate() - 1);
        } else {
            this.selectedDate.setDate(this.selectedDate.getDate() - 7);
        }
        this.selectedDate = new Date(this.selectedDate);
        this.loadDiary();
    }

    nextDate(): void {
        if (this.selectedPeriod === 'day') {
            this.selectedDate.setDate(this.selectedDate.getDate() + 1);
        } else {
            this.selectedDate.setDate(this.selectedDate.getDate() + 7);
        }
        this.selectedDate = new Date(this.selectedDate);
        this.loadDiary();
    }

    editIntake(intake: FoodIntake): void {
        this.selectedIntake = intake;
        this.editForm.patchValue({
            amount: intake.amount,
            unit: intake.unit,
            consumed_at: this.formatDateTime(new Date(intake.consumed_at)),
            notes: intake.notes || ''
        });
        
        this.showEditModal = true;
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    saveIntake(): void {
        if (this.editForm.valid && this.selectedIntake) {
            const updateData = {
                amount: Number(this.editForm.get('amount')?.value),
                unit: this.editForm.get('unit')?.value,
                consumed_at: this.editForm.get('consumed_at')?.value,
                notes: this.editForm.get('notes')?.value || ''
            };

            this.nutritionService.updateFoodIntake(this.selectedIntake.id, updateData).subscribe({
                next: () => {
                    this.showSuccessMessage('Запись обновлена');
                    this.closeEditModal();
                    this.loadDiary();
                },
                error: (error) => {
                    this.showErrorMessage('Ошибка обновления записи');
                    console.error('Update error:', error);
                }
            });
        }
    }

    deleteIntake(intake: FoodIntake): void {
        if (confirm('Вы уверены, что хотите удалить эту запись?')) {
            this.nutritionService.deleteFoodIntake(intake.id).subscribe({
                next: () => {
                    this.showSuccessMessage('Запись удалена');
                    this.loadDiary();
                },
                error: (error) => {
                    this.showErrorMessage('Ошибка удаления записи');
                    console.error('Delete error:', error);
                }
            });
        }
    }

    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedIntake = null;
        
        // Сбрасываем форму с начальными значениями
        this.editForm.reset({
            amount: 100,
            unit: 'g',
            consumed_at: '',
            notes: ''
        });
        
        // Разблокируем скролл body
        document.body.classList.remove('modal-open');
    }

    // Обработка клавиши Escape для закрытия модального окна
    @HostListener('document:keydown.escape', ['$event'])
    onEscapeKey(event: KeyboardEvent): void {
        if (this.showEditModal) {
            this.closeEditModal();
        }
    }

    // Utility methods
    formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    formatDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    getWeekDates(date: Date): Date[] {
        const dates = [];
        const startOfWeek = new Date(date);
        const dayOfWeek = startOfWeek.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            dates.push(currentDate);
        }
        return dates;
    }

    formatNumber(value: number | string | null | undefined): string {
        if (value === null || value === undefined || value === '') return '0';
        
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        
        return Number(num.toFixed(1)).toString();
    }

    getUnitDisplay(unit: string): string {
        const unitMap: {[key: string]: string} = {
            'g': 'г',
            'ml': 'мл',
            'pieces': 'шт',
            'tbsp': 'ст.л.',
            'tsp': 'ч.л.',
            'cup': 'стак.',
            'serving': 'порц.'
        };
        return unitMap[unit] || unit;
    }

    getIntakeIcon(intake: FoodIntake): string {
        if (intake.recipe) {
            return 'fa-utensils';
        } else if (intake.user_product) {
            return 'fa-user-plus';
        } else {
            return 'fa-apple-alt';
        }
    }

    getIntakeImageUrl(intake: FoodIntake): string | null {
        if (intake.product_info && 'image_url' in intake.product_info) {
            return intake.product_info.image_url || null;
        }
        return null;
    }

    // Statistics calculations
    getCaloriesPercentage(): number {
        if (!this.dailyStats || !this.dailyGoal || this.dailyGoal.calories_goal === 0) return 0;
        return Math.round((this.dailyStats.calories / this.dailyGoal.calories_goal) * 100);
    }

    getProteinPercentage(): number {
        if (!this.dailyStats || !this.dailyGoal || this.dailyGoal.protein_goal === 0) return 0;
        return Math.round((this.dailyStats.protein / this.dailyGoal.protein_goal) * 100);
    }

    getFatPercentage(): number {
        if (!this.dailyStats || !this.dailyGoal || this.dailyGoal.fat_goal === 0) return 0;
        return Math.round((this.dailyStats.fat / this.dailyGoal.fat_goal) * 100);
    }

    getCarbohydratePercentage(): number {
        if (!this.dailyStats || !this.dailyGoal || this.dailyGoal.carbohydrate_goal === 0) return 0;
        return Math.round((this.dailyStats.carbohydrate / this.dailyGoal.carbohydrate_goal) * 100);
    }

    getCaloriesRemaining(): number {
        if (!this.dailyStats || !this.dailyGoal || this.dailyGoal.calories_goal === 0) return 0;
        return this.dailyGoal.calories_goal - this.dailyStats.calories;
    }

    abs(value: number): number {
        return Math.abs(value);
    }

    // Pagination
    currentPage = 1;
    itemsPerPage = 12;
    totalItems = 0;
    paginatedIntakes: FoodIntake[] = [];

    private showSuccessMessage(message: string): void {
        if (typeof window !== 'undefined' && (window as any).alert) {
            (window as any).alert(message, 'success');
        }
    }

    private showErrorMessage(message: string): void {
        if (typeof window !== 'undefined' && (window as any).alert) {
            (window as any).alert(message, 'error');
        }
    }

    // Image error handling
    onImageError(event: any): void {
        event.target.src = 'assets/img/default-food.svg';
    }

    // Statistics circle update
    private updateCaloriesCircle(): void {
        setTimeout(() => {
            const circleElement = document.querySelector('.circle-progress') as HTMLElement;
            if (circleElement) {
                const percentage = this.getCaloriesPercentage();
                circleElement.style.setProperty('--percentage', percentage.toString());
            }
        }, 100);
    }

    // Pagination methods
    updatePagination(): void {
        this.totalItems = this.foodIntakes.length;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        this.paginatedIntakes = this.foodIntakes.slice(startIndex, endIndex);
    }

    getTotalPages(): number {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }

    changePage(page: number): void {
        if (page >= 1 && page <= this.getTotalPages()) {
            this.currentPage = page;
            this.updatePagination();
        }
    }

    getPageNumbers(): number[] {
        const totalPages = this.getTotalPages();
        const pages: number[] = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }
}
