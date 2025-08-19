import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NutritionService } from "../../../core/services";
import { Product, UserProduct, Recipe, SearchResults } from "../../../core/models";

@Component({
    selector: 'app-nutrition-search',
    templateUrl: './nutrition-search.component.html',
    styleUrls: ['./nutrition-search.component.scss']
})
export class NutritionSearchComponent implements OnInit {
    searchQuery = '';
    searchResults: SearchResults | null = null;
    isSearching = false;
    hasSearched = false;
    error = '';

    // Filtered results for display
    filteredFavorites: Product[] = [];
    filteredProducts: Product[] = [];
    filteredUserProducts: UserProduct[] = [];
    filteredRecipes: Recipe[] = [];

    // Filter options
    showFavorites = true;
    showProducts = true;
    showUserProducts = true;
    showRecipes = true;
    
    // Sort options
    sortBy = 'name';
    sortOrder = 'asc';

    // Pagination
    itemsPerPage = 12;
    currentPage = 1;
    totalPages = 1;
    
    // Paginated data
    paginatedFavorites: Product[] = [];
    paginatedProducts: Product[] = [];
    paginatedUserProducts: UserProduct[] = [];
    paginatedRecipes: Recipe[] = [];

    // Expose Math to template
    Math = Math;
    
    // Toast notifications
    showToast = false;
    toastMessage = '';
    toastType: 'success' | 'error' = 'success';
    
    constructor(
        private nutritionService: NutritionService,
        private titleService: Title
    ) {}

    ngOnInit(): void {
        this.titleService.setTitle('Поиск продуктов');
    }

    onSearch(): void {
        if (!this.searchQuery.trim()) {
            this.searchResults = null;
            this.hasSearched = false;
            return;
        }

        this.isSearching = true;
        this.error = '';

        this.nutritionService.searchProducts(this.searchQuery.trim(), 100).subscribe({
            next: (results) => {
                this.searchResults = results;
                this.hasSearched = true;
                this.applyFiltersAndSort();
                this.isSearching = false;
            },
            error: (error) => {
                this.error = 'Ошибка поиска продуктов';
                this.isSearching = false;
                console.error('Search error:', error);
            }
        });
    }

    onSearchInputChange(): void {
        if (!this.searchQuery.trim()) {
            this.searchResults = null;
            this.hasSearched = false;
        }
    }

    applyFiltersAndSort(): void {
        if (!this.searchResults) return;

        // Apply filters
        this.filteredFavorites = this.showFavorites ? [...this.searchResults.favorites] : [];
        this.filteredProducts = this.showProducts ? [...this.searchResults.products] : [];
        this.filteredUserProducts = this.showUserProducts ? [...this.searchResults.user_products] : [];
        this.filteredRecipes = this.showRecipes ? [...this.searchResults.recipes] : [];

        // Apply sorting
        this.sortItems();
        
        // Apply pagination
        this.updatePagination();
    }

    sortItems(): void {
        const sortFn = (a: any, b: any) => {
            let aVal, bVal;
            switch (this.sortBy) {
                case 'name':
                    aVal = a.name?.toLowerCase() || '';
                    bVal = b.name?.toLowerCase() || '';
                    break;
                case 'calories':
                    aVal = a.calories || a.calories_per_100g || 0;
                    bVal = b.calories || b.calories_per_100g || 0;
                    break;
                case 'protein':
                    aVal = a.protein || a.protein_per_100g || 0;
                    bVal = b.protein || b.protein_per_100g || 0;
                    break;
                default:
                    return 0;
            }

            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        };

        this.filteredFavorites.sort(sortFn);
        this.filteredProducts.sort(sortFn);
        this.filteredUserProducts.sort(sortFn);
        this.filteredRecipes.sort(sortFn);
    }

    onFilterChange(): void {
        this.currentPage = 1;
        this.applyFiltersAndSort();
    }

    onSortChange(): void {
        this.currentPage = 1;
        this.applyFiltersAndSort();
    }
    
    updatePagination(): void {
        const totalItems = this.getTotalResults();
        this.totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Calculate current page offset
        const offset = (this.currentPage - 1) * this.itemsPerPage;
        
        // Split all filtered results for pagination
        let allItems: any[] = [
            ...this.filteredFavorites.map(item => ({ ...item, type: 'favorite' })),
            ...this.filteredProducts.map(item => ({ ...item, type: 'product' })),
            ...this.filteredUserProducts.map(item => ({ ...item, type: 'user_product' })),
            ...this.filteredRecipes.map(item => ({ ...item, type: 'recipe' }))
        ];
        
        // Get items for current page
        const pageItems = allItems.slice(offset, offset + this.itemsPerPage);
        
        // Reset paginated arrays
        this.paginatedFavorites = [];
        this.paginatedProducts = [];
        this.paginatedUserProducts = [];
        this.paginatedRecipes = [];
        
        // Distribute items to appropriate arrays
        pageItems.forEach(item => {
            const { type, ...data } = item;
            switch (type) {
                case 'favorite':
                    this.paginatedFavorites.push(data);
                    break;
                case 'product':
                    this.paginatedProducts.push(data);
                    break;
                case 'user_product':
                    this.paginatedUserProducts.push(data);
                    break;
                case 'recipe':
                    this.paginatedRecipes.push(data);
                    break;
            }
        });
    }
    
    changePage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.updatePagination();
        }
    }
    
    getPageNumbers(): number[] {
        const pages: number[] = [];
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.searchResults = null;
        this.hasSearched = false;
        this.error = '';
        this.currentPage = 1;
        this.totalPages = 1;
        
        // Clear paginated arrays
        this.paginatedFavorites = [];
        this.paginatedProducts = [];
        this.paginatedUserProducts = [];
        this.paginatedRecipes = [];
    }

    // Quick action methods
    addToFavorites(product: Product): void {
        this.nutritionService.addToFavorites(product.product_id).subscribe({
            next: () => {
                // Add to local favorites array to avoid full refresh
                if (this.searchResults && !this.isProductInFavorites(product)) {
                    this.searchResults.favorites.push(product);
                    this.applyFiltersAndSort();
                }
                this.showSuccessMessage('Продукт добавлен в избранное');
            },
            error: (error) => {
                this.showErrorMessage('Ошибка добавления в избранное');
                console.error('Error adding to favorites:', error);
            }
        });
    }

    removeFromFavorites(product: Product): void {
        this.nutritionService.removeFromFavorites(product.product_id).subscribe({
            next: () => {
                // Remove from local favorites array to avoid full refresh
                if (this.searchResults) {
                    this.searchResults.favorites = this.searchResults.favorites.filter(
                        fav => fav.product_id !== product.product_id
                    );
                    this.applyFiltersAndSort();
                }
                this.showSuccessMessage('Продукт удален из избранного');
            },
            error: (error) => {
                this.showErrorMessage('Ошибка удаления из избранного');
                console.error('Error removing from favorites:', error);
            }
        });
    }

    quickAddToIntake(item: Product | UserProduct | Recipe, amount: number = 100): void {
        const data: any = {
            amount: amount,
            unit: 'g'
        };

        if ('product_id' in item) {
            // It's a Product
            data.product_id = item.product_id;
        } else if ('id' in item && 'protein' in item && !('servings' in item)) {
            // It's a UserProduct (has id, protein but no servings)
            data.user_product_id = item.id;
        } else if ('id' in item && 'servings' in item) {
            // It's a Recipe (has id and servings)
            data.recipe_id = item.id;
        }

        this.nutritionService.quickAddIntake(data).subscribe({
            next: () => {
                this.showSuccessMessage('Продукт добавлен в дневник питания');
            },
            error: (error) => {
                this.showErrorMessage('Ошибка добавления продукта');
                console.error('Error adding to intake:', error);
            }
        });
    }

    showSuccessMessage(message: string): void {
        this.showToastMessage(message, 'success');
    }

    showErrorMessage(message: string): void {
        this.showToastMessage(message, 'error');
    }
    
    showToastMessage(message: string, type: 'success' | 'error'): void {
        this.toastMessage = message;
        this.toastType = type;
        this.showToast = true;
        
        // Автоматически скрыть через 3 секунды
        setTimeout(() => {
            this.hideToast();
        }, 3000);
    }
    
    hideToast(): void {
        this.showToast = false;
        setTimeout(() => {
            this.toastMessage = '';
        }, 300); // Ждем завершения анимации
    }

    // Utility methods
    getTotalResults(): number {
        return this.filteredFavorites.length + 
               this.filteredProducts.length + 
               this.filteredUserProducts.length + 
               this.filteredRecipes.length;
    }

    getFavoritesCount(): number {
        return this.filteredFavorites.length;
    }

    getProductsCount(): number {
        return this.filteredProducts.length;
    }

    getUserProductsCount(): number {
        return this.filteredUserProducts.length;
    }

    getRecipesCount(): number {
        return this.filteredRecipes.length;
    }

    isProductInFavorites(product: Product): boolean {
        return this.searchResults?.favorites.some(fav => fav.product_id === product.product_id) || false;
    }

    formatNumber(value: number | string | null | undefined): string {
        if (value === null || value === undefined || value === '') return '0';
        
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        
        // Округляем до 1 знака после запятой и удаляем лишние нули
        return Number(num.toFixed(1)).toString();
    }
    
    onImageError(event: Event): void {
        // Handle image loading errors by hiding the image and showing placeholder
        const img = event.target as HTMLImageElement;
        if (img) {
            img.style.display = 'none';
            const placeholder = img.parentElement?.querySelector('.product-image-placeholder') as HTMLElement;
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    }
    
    onImageLoad(event: Event): void {
        // Handle successful image loading
        const img = event.target as HTMLImageElement;
        if (img) {
            img.style.opacity = '1';
        }
    }


}
