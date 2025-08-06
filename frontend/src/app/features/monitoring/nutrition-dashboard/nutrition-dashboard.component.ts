import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {
    DailyGoal,
    DashboardData,
    FoodIntake,
    NutritionStats,
    Product,
    Recipe,
    SearchResults,
    UserProduct
} from "../../../core/models";
import {NutritionService} from "../../../core/services";


@Component({
    selector: 'app-nutrition-dashboard',
    templateUrl: './nutrition-dashboard.component.html',
    styleUrls: ['./nutrition-dashboard.component.scss']
})
export class NutritionDashboardComponent implements OnInit {
    today = new Date();
    showSearchModal = false;
    dashboardData: DashboardData | null = null;
    todayStats: NutritionStats | null = null;
    dailyGoal: DailyGoal | null = null;
    recentIntakes: FoodIntake[] = [];

    searchQuery = '';
    searchResults: SearchResults | null = null;
    isSearching = false;
    showSearchResults = false;

    addIntakeForm: FormGroup;
    showAddIntakeModal = false;
    selectedProduct: Product | UserProduct | Recipe | null = null;
    selectedProductType: 'product' | 'user_product' | 'recipe' = 'product';

    isLoading = false;
    error = '';

    constructor(
        private nutritionService: NutritionService,
        private fb: FormBuilder
    ) {
        this.addIntakeForm = this.fb.group({
            amount: [100, [Validators.required, Validators.min(1)]],
            unit: ['g', Validators.required],
            meal_type: ['breakfast', Validators.required],
            notes: ['']
        });
    }

    ngOnInit(): void {
        this.loadDashboard();
        this.updateCaloriesCircle();
    }

    loadDashboard(): void {
        this.isLoading = true;
        this.nutritionService.getDashboard().subscribe({
            next: (data) => {
                this.dashboardData = data;
                this.todayStats = data.today_stats;
                this.dailyGoal = data.goal;
                this.recentIntakes = data.recent_intakes;
                this.isLoading = false;
                this.updateCaloriesCircle();
            },
            error: (error) => {
                this.error = 'Ошибка загрузки данных';
                this.isLoading = false;
                console.error('Dashboard error:', error);
            }
        });
    }

    abs(value: number): number {
        return Math.abs(value);
    }

    onSearchInput(event: any): void {
        const query = event.target.value.trim();
        this.searchQuery = query;

        if (query.length < 2) {
            this.searchResults = null;
            this.showSearchResults = false;
            return;
        }

        this.isSearching = true;
        this.nutritionService.searchProducts(query, 10).subscribe({
            next: (results) => {
                this.searchResults = results;
                this.showSearchResults = true;
                this.isSearching = false;
            },
            error: (error) => {
                this.isSearching = false;
                console.error('Search error:', error);
            }
        });
    }

    selectProduct(product: Product | UserProduct | Recipe, type: 'product' | 'user_product' | 'recipe'): void {
        this.selectedProduct = product;
        this.selectedProductType = type;
        this.showAddIntakeModal = true;
        this.showSearchResults = false;
        this.searchQuery = '';
    }

    addIntake(): void {
        if (this.addIntakeForm.valid && this.selectedProduct) {
            const formData = this.addIntakeForm.value;

            let requestData: any = {
                amount: formData.amount,
                unit: formData.unit,
                consumed_at: new Date().toISOString(),
                notes: formData.notes
            };

            switch (this.selectedProductType) {
                case 'product':
                    requestData.product_id = (this.selectedProduct as Product).product_id;
                    break;
                case 'user_product':
                    requestData.user_product_id = (this.selectedProduct as UserProduct).id;
                    break;
                case 'recipe':
                    requestData.recipe_id = (this.selectedProduct as Recipe).id;
                    break;
            }

            this.nutritionService.quickAddIntake(requestData).subscribe({
                next: () => {
                    this.closeAddIntakeModal();
                    this.closeSearchModal(); // добавить эту строку
                    this.loadDashboard();
                    this.showSuccessMessage('Продукт добавлен в дневник');
                },
                error: (error) => {
                    console.error('Add intake error:', error);
                    this.showErrorMessage('Ошибка добавления продукта');
                }
            });
        }
    }

    closeAddIntakeModal(): void {
        this.showAddIntakeModal = false;
        this.selectedProduct = null;
        this.addIntakeForm.reset({
            amount: 100,
            unit: 'g',
            meal_type: 'breakfast',
            notes: ''
        });
    }

    addToFavorites(product: Product): void {
        this.nutritionService.addToFavorites(product.product_id).subscribe({
            next: () => {
                this.showSuccessMessage('Добавлено в избранное');
            },
            error: (error) => {
                console.error('Add to favorites error:', error);
                this.showErrorMessage('Ошибка добавления в избранное');
            }
        });
    }

    getCaloriesPercentage(): number {
        if (!this.todayStats || !this.dailyGoal) return 0;
        return Math.round((this.todayStats.calories / this.dailyGoal.calories_goal) * 100);
    }

    getProteinPercentage(): number {
        if (!this.todayStats || !this.dailyGoal) return 0;
        return Math.round((this.todayStats.protein / this.dailyGoal.protein_goal) * 100);
    }

    getFatPercentage(): number {
        if (!this.todayStats || !this.dailyGoal) return 0;
        return Math.round((this.todayStats.fat / this.dailyGoal.fat_goal) * 100);
    }

    getCarbohydratePercentage(): number {
        if (!this.todayStats || !this.dailyGoal) return 0;
        return Math.round((this.todayStats.carbohydrate / this.dailyGoal.carbohydrate_goal) * 100);
    }

    getProgressBarClass(percentage: number): string {
        if (percentage <= 50) return 'bg-danger';
        if (percentage <= 80) return 'bg-warning';
        if (percentage <= 100) return 'bg-success';
        return 'bg-info';
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.searchResults = null;
        this.showSearchResults = false;
    }

    private showSuccessMessage(message: string): void {
        console.log('Success:', message);
    }

    private showErrorMessage(message: string): void {
        console.error('Error:', message);
    }

    getProductName(): string {
        if (!this.selectedProduct) return '';
        return this.selectedProduct.name;
    }

    getProductCalories(): number {
        if (!this.selectedProduct) return 0;
        if (this.selectedProductType === 'recipe') {
            return (this.selectedProduct as Recipe).calories_per_100g || 0;
        }
        return (this.selectedProduct as Product | UserProduct).calories || 0;
    }

    getProductProtein(): number {
        if (!this.selectedProduct) return 0;
        if (this.selectedProductType === 'recipe') {
            return (this.selectedProduct as Recipe).protein_per_100g || 0;
        }
        return (this.selectedProduct as Product | UserProduct).protein || 0;
    }

    getProductFat(): number {
        if (!this.selectedProduct) return 0;
        if (this.selectedProductType === 'recipe') {
            return (this.selectedProduct as Recipe).fat_per_100g || 0;
        }
        return (this.selectedProduct as Product | UserProduct).fat || 0;
    }

    getProductCarbohydrate(): number {
        if (!this.selectedProduct) return 0;
        if (this.selectedProductType === 'recipe') {
            return (this.selectedProduct as Recipe).carbohydrate_per_100g || 0;
        }
        return (this.selectedProduct as Product | UserProduct).carbohydrate || 0;
    }

    openSearchModal(): void {
        this.showSearchModal = true;
    }

    closeSearchModal(): void {
        this.showSearchModal = false;
        this.clearSearch();
    }

    getCaloriesRemaining(): number {
        if (!this.todayStats || !this.dailyGoal) return 0;
        return this.dailyGoal.calories_goal - this.todayStats.calories;
    }

    private updateCaloriesCircle(): void {
        setTimeout(() => {
            const circleElement = document.querySelector('.circle-progress') as HTMLElement;
            if (circleElement) {
                const percentage = this.getCaloriesPercentage();
                circleElement.style.setProperty('--percentage', percentage.toString());
            }
        }, 100);
    }

}