import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { NutritionService } from "../../../core/services";
import { Product, Recipe, UserProduct, RecipeIngredient } from "../../../core/models";
import {Title} from "@angular/platform-browser";

@Component({
    selector: 'app-nutrition-recipes',
    templateUrl: './nutrition-recipes.component.html',
    styleUrls: ['./nutrition-recipes.component.scss']
})
export class NutritionRecipesComponent implements OnInit {
    recipes: Recipe[] = [];
    filteredRecipes: Recipe[] = [];
    isLoading = false;
    error = '';

    // Filter and sort
    searchFilter = '';
    sortBy = 'created_at';
    sortOrder = 'desc';

    // Modal states
    showCreateModal = false;
    showEditModal = false;
    showViewModal = false;
    showDeleteModal = false;
    selectedRecipe: Recipe | null = null;

    // Forms
    createRecipeForm: FormGroup;
    editRecipeForm: FormGroup;

    // Search for ingredients
    searchQuery = '';
    searchResults: any = null;
    isSearching = false;
    showSearchResults = false;
    currentSearchIndex = -1;

    // Image upload
    selectedImage: File | null = null;
    imagePreview: string | null = null;

    constructor(
        private nutritionService: NutritionService,
        private titleService: Title,
        private fb: FormBuilder
    ) {
        this.titleService.setTitle('Рецепты');
        this.createRecipeForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            description: [''],
            servings: [1, [Validators.required, Validators.min(1)]],
            ingredients: this.fb.array([])
        });

        this.editRecipeForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            description: [''],
            servings: [1, [Validators.required, Validators.min(1)]],
            ingredients: this.fb.array([])
        });
    }

    ngOnInit(): void {
        this.loadRecipes();
    }

    loadRecipes(): void {
        this.isLoading = true;
        this.error = '';
        console.log('Loading recipes...');
        this.nutritionService.getRecipes().subscribe({
            next: (recipes) => {
                console.log('Recipes loaded:', recipes);
                this.recipes = recipes;
                this.applyFilters();
                this.isLoading = false;
            },
            error: (error) => {
                this.error = 'Ошибка загрузки рецептов';
                this.isLoading = false;
                console.error('Error loading recipes:', error);
            }
        });
    }

    // Ingredient FormArray helpers
    get createIngredientsFormArray(): FormArray {
        return this.createRecipeForm.get('ingredients') as FormArray;
    }

    get editIngredientsFormArray(): FormArray {
        return this.editRecipeForm.get('ingredients') as FormArray;
    }

    createIngredientFormGroup(): FormGroup {
        return this.fb.group({
            product_id: [null],
            user_product_id: [null],
            product_name: [''],
            amount: [100, [Validators.required, Validators.min(0.1)]],
            unit: ['g', Validators.required]
        });
    }

    addIngredient(formArray: FormArray): void {
        formArray.push(this.createIngredientFormGroup());
    }

    removeIngredient(formArray: FormArray, index: number): void {
        formArray.removeAt(index);
    }

    // Recipe operations
    openCreateModal(): void {
        this.createRecipeForm.reset({
            name: '',
            description: '',
            servings: 1,
            ingredients: []
        });
        this.createIngredientsFormArray.clear();
        this.addIngredient(this.createIngredientsFormArray);
        this.showCreateModal = true;
    }

    closeCreateModal(): void {
        this.showCreateModal = false;
        this.createRecipeForm.reset();
        this.createIngredientsFormArray.clear();
        this.selectedImage = null;
        this.imagePreview = null;
        this.searchQuery = '';
        this.searchResults = null;
        this.showSearchResults = false;
    }

    createRecipe(): void {
        if (this.createRecipeForm.valid) {
            const formData = this.createRecipeForm.value;
            
            const ingredients = formData.ingredients.filter((ing: any) => 
                (ing.product_id || ing.user_product_id) && ing.amount > 0
            ).map((ing: any) => ({
                product_id: ing.product_id || null,
                user_product_id: ing.user_product_id || null,
                amount: Number(ing.amount),
                unit: ing.unit || 'g'
            }));

            if (ingredients.length === 0) {
                this.showErrorMessage('Добавьте хотя бы один ингредиент с выбранным продуктом');
                return;
            }

            const recipeData = {
                name: formData.name.trim(),
                description: formData.description ? formData.description.trim() : '',
                servings: Number(formData.servings),
                ingredients: ingredients
            };

            this.nutritionService.createRecipe(recipeData).subscribe({
                next: (recipe) => {
                    if (this.selectedImage) {
                        this.nutritionService.uploadRecipeImage(recipe.id, this.selectedImage).subscribe({
                            next: () => {
                                this.showSuccessMessage('Рецепт создан успешно');
                                this.closeCreateModal();
                                this.loadRecipes();
                            },
                            error: (error) => {
                                console.error('Error uploading image:', error);
                                this.showSuccessMessage('Рецепт создан, но изображение не загружено');
                                this.closeCreateModal();
                                this.loadRecipes();
                            }
                        });
                    } else {
                        this.showSuccessMessage('Рецепт создан успешно');
                        this.closeCreateModal();
                        this.loadRecipes();
                    }
                },
                error: (error) => {
                    console.error('Error creating recipe:', error);
                    this.handleApiError(error, 'Ошибка создания рецепта');
                }
            });
        } else {
            this.markFormGroupTouched(this.createRecipeForm);
            this.showErrorMessage('Проверьте правильность заполнения формы');
        }
    }

    viewRecipe(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showViewModal = true;
    }

    closeViewModal(): void {
        this.showViewModal = false;
        this.selectedRecipe = null;
    }

    editRecipe(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.nutritionService.getRecipe(recipe.id).subscribe({
            next: (fullRecipe) => {
                this.populateEditForm(fullRecipe);
                this.showViewModal = false;
                this.showEditModal = true;
            },
            error: (error) => {
                console.error('Error loading recipe details:', error);
                this.showErrorMessage('Ошибка загрузки рецепта');
            }
        });
    }

    populateEditForm(recipe: Recipe): void {
        this.editRecipeForm.patchValue({
            name: recipe.name,
            description: recipe.description,
            servings: recipe.servings
        });

        // Reset image state
        this.selectedImage = null;
        this.imagePreview = null;

        this.editIngredientsFormArray.clear();

        if (recipe.ingredients && recipe.ingredients.length > 0) {
            recipe.ingredients.forEach(ingredient => {
                const ingredientGroup = this.fb.group({
                    product_id: [ingredient.product_id],
                    user_product_id: [ingredient.user_product ? ingredient.user_product.id : null],
                    product_name: [ingredient.product_name],
                    amount: [ingredient.amount, [Validators.required, Validators.min(0.1)]],
                    unit: [ingredient.unit, Validators.required]
                });
                this.editIngredientsFormArray.push(ingredientGroup);
            });
        } else {
            this.addIngredient(this.editIngredientsFormArray);
        }
    }

    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedRecipe = null;
        this.editRecipeForm.reset();
        this.editIngredientsFormArray.clear();
        this.selectedImage = null;
        this.imagePreview = null;
    }

    updateRecipe(): void {
        if (this.editRecipeForm.valid && this.selectedRecipe) {
            const formData = this.editRecipeForm.value;
            
            const ingredients = formData.ingredients.filter((ing: any) => 
                (ing.product_id || ing.user_product_id) && ing.amount > 0
            ).map((ing: any) => ({
                product_id: ing.product_id || null,
                user_product_id: ing.user_product_id || null,
                amount: Number(ing.amount),
                unit: ing.unit || 'g'
            }));

            if (ingredients.length === 0) {
                this.showErrorMessage('Добавьте хотя бы один ингредиент с выбранным продуктом');
                return;
            }

            const recipeData = {
                name: formData.name.trim(),
                description: formData.description ? formData.description.trim() : '',
                servings: Number(formData.servings),
                ingredients: ingredients
            };

            this.nutritionService.updateRecipe(this.selectedRecipe.id, recipeData).subscribe({
                next: (recipe) => {
                    if (this.selectedImage) {
                        this.nutritionService.uploadRecipeImage(recipe.id, this.selectedImage).subscribe({
                            next: () => {
                                this.showSuccessMessage('Рецепт обновлен успешно');
                                this.closeEditModal();
                                this.loadRecipes();
                            },
                            error: (error) => {
                                console.error('Error uploading image:', error);
                                this.showSuccessMessage('Рецепт обновлен, но изображение не загружено');
                                this.closeEditModal();
                                this.loadRecipes();
                            }
                        });
                    } else {
                        this.showSuccessMessage('Рецепт обновлен успешно');
                        this.closeEditModal();
                        this.loadRecipes();
                    }
                },
                error: (error) => {
                    console.error('Error updating recipe:', error);
                    this.showErrorMessage('Ошибка обновления рецепта');
                }
            });
        } else {
            this.markFormGroupTouched(this.editRecipeForm);
            this.showErrorMessage('Проверьте правильность заполнения формы');
        }
    }

    confirmDelete(recipe: Recipe): void {
        this.selectedRecipe = recipe;
        this.showDeleteModal = true;
    }

    deleteRecipe(): void {
        if (this.selectedRecipe) {
            this.nutritionService.deleteRecipe(this.selectedRecipe.id).subscribe({
                next: () => {
                    this.showSuccessMessage('Рецепт удален');
                    this.showDeleteModal = false;
                    this.selectedRecipe = null;
                    this.loadRecipes();
                },
                error: (error) => {
                    console.error('Error deleting recipe:', error);
                    this.showErrorMessage('Ошибка удаления рецепта');
                }
            });
        }
    }

    closeDeleteModal(): void {
        this.showDeleteModal = false;
        this.selectedRecipe = null;
    }

    // Search for ingredients
    onIngredientSearch(event: any, index?: number): void {
        const query = event.target.value.trim();
        this.searchQuery = query;
        this.currentSearchIndex = index !== undefined ? index : -1;

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

    selectIngredient(product: Product | UserProduct, type: 'product' | 'user_product', targetIndex?: number, formArray?: FormArray): void {
        const array = formArray || this.createIngredientsFormArray;
        
        // Find first empty ingredient slot or create new one
        let index = targetIndex;
        if (index === undefined || index === -1) {
            index = array.controls.findIndex(control => 
                !control.get('product_id')?.value && !control.get('user_product_id')?.value
            );
            
            if (index === -1) {
                // No empty slot found, add new ingredient
                this.addIngredient(array);
                index = array.length - 1;
            }
        }
        
        const ingredientGroup = array.at(index) as FormGroup;
        
        if (type === 'product') {
            const prod = product as Product;
            ingredientGroup.patchValue({
                product_id: prod.product_id,
                user_product_id: null,
                product_name: prod.name
            });
        } else {
            const userProd = product as UserProduct;
            ingredientGroup.patchValue({
                product_id: null,
                user_product_id: userProd.id,
                product_name: userProd.name
            });
        }

        this.showSearchResults = false;
        this.searchQuery = '';
        this.currentSearchIndex = -1;
    }

    // Add recipe to diary
    addRecipeToDay(recipe: Recipe): void {
        // Create a data object similar to how nutrition dashboard does it
        const requestData = {
            recipe_id: recipe.id,
            amount: 100, // Default 100g
            unit: 'g',
            consumed_at: new Date().toISOString(),
            notes: `Добавлено из рецепта: ${recipe.name}`
        };

        this.nutritionService.quickAddIntake(requestData).subscribe({
            next: (response) => {
                this.showSuccessMessage(`Рецепт "${recipe.name}" добавлен в дневник питания`);
            },
            error: (error) => {
                console.error('Error adding recipe to diary:', error);
                this.showErrorMessage('Ошибка добавления рецепта в дневник');
            }
        });
    }

    // Image handling
    onImageSelected(event: any): void {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                this.selectedImage = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imagePreview = e.target?.result as string;
                };
                reader.readAsDataURL(file);
            } else {
                this.showErrorMessage('Пожалуйста, выберите изображение');
            }
        }
    }

    removeImage(): void {
        this.selectedImage = null;
        this.imagePreview = null;
        
        // If we're editing a recipe with an existing image, mark it for deletion
        if (this.showEditModal && this.selectedRecipe?.image_url) {
            this.deleteExistingImage();
        }
    }

    deleteExistingImage(): void {
        if (this.selectedRecipe?.id) {
            this.nutritionService.deleteRecipeImage(this.selectedRecipe.id).subscribe({
                next: () => {
                    this.showSuccessMessage('Изображение удалено успешно');
                    if (this.selectedRecipe) {
                        this.selectedRecipe.image_url = undefined;
                    }
                },
                error: (error) => {
                    console.error('Error deleting image:', error);
                    this.showErrorMessage('Ошибка удаления изображения');
                }
            });
        }
    }

    // Utility methods
    formatNumber(value: number | string | null | undefined): string {
        if (value === null || value === undefined || value === '') return '0';
        
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        
        return Number(num.toFixed(1)).toString();
    }

    private markFormGroupTouched(formGroup: FormGroup): void {
        Object.keys(formGroup.controls).forEach(key => {
            const control = formGroup.get(key);
            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            } else if (control instanceof FormArray) {
                control.controls.forEach(arrayControl => {
                    if (arrayControl instanceof FormGroup) {
                        this.markFormGroupTouched(arrayControl);
                    } else {
                        arrayControl.markAsTouched();
                    }
                });
            } else {
                control?.markAsTouched();
            }
        });
    }

    private handleApiError(error: any, defaultMessage: string): void {
        let errorMessage = defaultMessage;
        
        if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else if (error.error && typeof error.error === 'object') {
            const fieldErrors = Object.entries(error.error).map(([field, errors]: [string, any]) => {
                const errorArray = Array.isArray(errors) ? errors : [errors];
                return `${field}: ${errorArray.join(', ')}`;
            });
            if (fieldErrors.length > 0) {
                errorMessage = fieldErrors.join('; ');
            }
        }
        
        this.showErrorMessage(errorMessage);
    }

    private showSuccessMessage(message: string): void {
        console.log('Success:', message);
        alert(message);
    }

    private showErrorMessage(message: string): void {
        console.error('Error:', message);
        alert(message);
    }

    getRecipeStats(recipe: Recipe): string {
        return `${this.formatNumber(recipe.calories_per_100g)} ккал • ${recipe.servings} порц.`;
    }

    getRecipeNutrition(recipe: Recipe): string {
        return `Б: ${this.formatNumber(recipe.protein_per_100g)}г • Ж: ${this.formatNumber(recipe.fat_per_100g)}г • У: ${this.formatNumber(recipe.carbohydrate_per_100g)}г`;
    }

    // Filter and sort methods
    applyFilters(): void {
        let filtered = [...this.recipes];

        // Apply search filter
        if (this.searchFilter.trim()) {
            const query = this.searchFilter.toLowerCase();
            filtered = filtered.filter(recipe =>
                recipe.name.toLowerCase().includes(query) ||
                (recipe.description && recipe.description.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: any, bValue: any;

            switch (this.sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'calories':
                    aValue = a.calories_per_100g;
                    bValue = b.calories_per_100g;
                    break;
                case 'servings':
                    aValue = a.servings;
                    bValue = b.servings;
                    break;
                case 'created_at':
                default:
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
            }

            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.filteredRecipes = filtered;
    }

    onSearchChange(): void {
        this.applyFilters();
    }

    onSortChange(event: any): void {
        const value = event.target.value;
        const [sortBy, sortOrder] = value.split('_');
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        this.applyFilters();
    }

    // Stats methods for template
    getTotalRecipes(): number {
        return this.recipes.length;
    }

    getGroupRecipes(): number {
        return this.recipes.filter(recipe => recipe.servings >= 4).length;
    }

    getQuickRecipes(): number {
        return this.recipes.filter(recipe => recipe.servings <= 2).length;
    }

    getAverageCalories(): number {
        if (this.recipes.length === 0) return 0;
        
        const validRecipes = this.recipes.filter(recipe => 
            recipe.calories_per_100g !== null && 
            recipe.calories_per_100g !== undefined && 
            !isNaN(recipe.calories_per_100g)
        );
        
        if (validRecipes.length === 0) return 0;
        
        const totalCalories = validRecipes.reduce((sum, recipe) => sum + recipe.calories_per_100g, 0);
        const average = totalCalories / validRecipes.length;
        
        return isNaN(average) ? 0 : Math.round(average);
    }
}
