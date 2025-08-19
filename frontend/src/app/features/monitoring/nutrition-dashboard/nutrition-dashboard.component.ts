import {Component, OnInit} from '@angular/core';
import { Title } from '@angular/platform-browser';
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
        private titleService: Title,
        private fb: FormBuilder
    ) {
        this.addIntakeForm = this.fb.group({
            amount: [100, [Validators.required, Validators.min(1)]],
            unit: ['g', Validators.required],
            consumed_at: [this.getCurrentDateTime(), Validators.required],
            notes: ['']
        });
    }

    ngOnInit(): void {
        this.titleService.setTitle('Панель питания');
        this.loadDashboard();
        this.updateCaloriesCircle();
    }

    loadDashboard(): void {
        this.isLoading = true;
        this.nutritionService.getDashboard().subscribe({
            next: (data: any) => {
                console.log('Dashboard API response:', data);
                this.dashboardData = data;
                // Маппинг данных из API в ожидаемую структуру
                this.todayStats = data.today ? {
                    date: data.today.date,
                    calories: parseFloat(data.today.total_calories) || 0,
                    protein: parseFloat(data.today.total_protein) || 0,
                    fat: parseFloat(data.today.total_fat) || 0,
                    carbohydrate: parseFloat(data.today.total_carbohydrate) || 0
                } : null;
                
                this.dailyGoal = data.daily_goal ? {
                    id: '1',
                    calories_goal: parseFloat(data.daily_goal.calories_goal) || 0,
                    protein_goal: parseFloat(data.daily_goal.protein_goal) || 0,
                    fat_goal: parseFloat(data.daily_goal.fat_goal) || 0,
                    carbohydrate_goal: parseFloat(data.daily_goal.carbohydrate_goal) || 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                } : null;
                
                this.recentIntakes = data.recent_intakes || [];
                
                console.log('Mapped todayStats:', this.todayStats);
                console.log('Mapped dailyGoal:', this.dailyGoal);
                
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
        this.nutritionService.searchProducts(query, 30).subscribe({
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

            // Prepare request data according to backend API requirements
            let requestData: any = {
                amount: Number(formData.amount), // Ensure amount is a number
                unit: formData.unit || 'g', // Default unit if not specified
                consumed_at: formData.consumed_at || new Date().toISOString(),
                notes: formData.notes || '' // Default empty string if no notes
            };

            // Add the specific product identifier based on type
            switch (this.selectedProductType) {
                case 'product':
                    requestData.product_id = (this.selectedProduct as Product).product_id;
                    // Remove any conflicting IDs
                    delete requestData.user_product_id;
                    delete requestData.recipe_id;
                    break;
                case 'user_product':
                    requestData.user_product_id = (this.selectedProduct as UserProduct).id;
                    // Remove any conflicting IDs
                    delete requestData.product_id;
                    delete requestData.recipe_id;
                    break;
                case 'recipe':
                    requestData.recipe_id = (this.selectedProduct as Recipe).id;
                    // Remove any conflicting IDs
                    delete requestData.product_id;
                    delete requestData.user_product_id;
                    break;
            }

            console.log('Sending request data:', requestData); // Debug log

            this.nutritionService.quickAddIntake(requestData).subscribe({
                next: (response) => {
                    console.log('Add intake success:', response); // Debug log
                    this.closeAddIntakeModal();
                    this.closeSearchModal();
                    this.loadDashboard(); // Reload dashboard to show updated stats
                    this.showSuccessMessage('Продукт добавлен в дневник');
                },
                error: (error) => {
                    console.error('Add intake error:', error);
                    let errorMessage = 'Ошибка добавления продукта';
                    
                    // Handle specific error cases
                    if (error.error && error.error.message) {
                        errorMessage = error.error.message;
                    } else if (error.error && typeof error.error === 'object') {
                        // Handle field validation errors
                        const fieldErrors = Object.values(error.error).flat();
                        if (fieldErrors.length > 0) {
                            errorMessage = fieldErrors.join(', ');
                        }
                    }
                    
                    this.showErrorMessage(errorMessage);
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
            consumed_at: this.getCurrentDateTime(),
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
        if (!this.todayStats || !this.dailyGoal || this.dailyGoal.calories_goal === 0) return 0;
        return Math.round((this.todayStats.calories / this.dailyGoal.calories_goal) * 100);
    }

    getProteinPercentage(): number {
        if (!this.todayStats || !this.dailyGoal || this.dailyGoal.protein_goal === 0) return 0;
        return Math.round((this.todayStats.protein / this.dailyGoal.protein_goal) * 100);
    }

    getFatPercentage(): number {
        if (!this.todayStats || !this.dailyGoal || this.dailyGoal.fat_goal === 0) return 0;
        return Math.round((this.todayStats.fat / this.dailyGoal.fat_goal) * 100);
    }

    getCarbohydratePercentage(): number {
        if (!this.todayStats || !this.dailyGoal || this.dailyGoal.carbohydrate_goal === 0) return 0;
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
        if (!this.todayStats || !this.dailyGoal || this.dailyGoal.calories_goal === 0) return 0;
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

    getIntakeImageUrl(intake: FoodIntake): string | null {
        if (intake.product_info) {
            if ('image_url' in intake.product_info) {
                return (intake.product_info as Product | UserProduct).image_url || null;
            }
        }
        return null;
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

    getTotalResults(): number {
        if (!this.searchResults) return 0;
        return (this.searchResults.products?.length || 0) +
               (this.searchResults.user_products?.length || 0) +
               (this.searchResults.recipes?.length || 0) +
               (this.searchResults.favorites?.length || 0);
    }

    getProductTypeIcon(): string {
        switch (this.selectedProductType) {
            case 'product':
                return 'fa-apple-alt';
            case 'user_product':
                return 'fa-user-plus';
            case 'recipe':
                return 'fa-utensils';
            default:
                return 'fa-question';
        }
    }

    getProductTypeLabel(): string {
        switch (this.selectedProductType) {
            case 'product':
                return 'Продукт';
            case 'user_product':
                return 'Мой продукт';
            case 'recipe':
                return 'Рецепт';
            default:
                return 'Неизвестно';
        }
    }

    getCalculatedCalories(): number {
        if (!this.selectedProduct || !this.addIntakeForm.get('amount')?.value) return 0;
        const amount = Number(this.addIntakeForm.get('amount')?.value);
        const calories = this.getProductCalories();
        return Math.round((calories * amount) / 100 * 10) / 10; // Round to 1 decimal place
    }

    getCalculatedProtein(): number {
        if (!this.selectedProduct || !this.addIntakeForm.get('amount')?.value) return 0;
        const amount = Number(this.addIntakeForm.get('amount')?.value);
        const protein = this.getProductProtein();
        return Math.round((protein * amount) / 100 * 10) / 10; // Round to 1 decimal place
    }

    getCalculatedFat(): number {
        if (!this.selectedProduct || !this.addIntakeForm.get('amount')?.value) return 0;
        const amount = Number(this.addIntakeForm.get('amount')?.value);
        const fat = this.getProductFat();
        return Math.round((fat * amount) / 100 * 10) / 10; // Round to 1 decimal place
    }

    getCalculatedCarbohydrate(): number {
        if (!this.selectedProduct || !this.addIntakeForm.get('amount')?.value) return 0;
        const amount = Number(this.addIntakeForm.get('amount')?.value);
        const carbohydrate = this.getProductCarbohydrate();
        return Math.round((carbohydrate * amount) / 100 * 10) / 10; // Round to 1 decimal place
    }

    getCurrentDateTime(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    formatNumber(value: number | string | null | undefined): string {
        if (value === null || value === undefined || value === '') return '0';
        
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        
        // Округляем до 1 знака после запятой и удаляем лишние нули
        return Number(num.toFixed(1)).toString();
    }
}