import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NutritionService } from "../../../core/services";
import { UserProduct } from "../../../core/models";

@Component({
    selector: 'app-nutrition-my-products',
    templateUrl: './nutrition-my-products.component.html',
    styleUrls: ['./nutrition-my-products.component.scss']
})
export class NutritionMyProductsComponent implements OnInit {
    userProducts: UserProduct[] = [];
    filteredProducts: UserProduct[] = [];
    isLoading = false;
    error = '';

    // Filter and sort
    searchFilter = '';
    sortBy = 'created_at';
    sortOrder = 'desc';

    // Modal states
    showEditModal = false;
    showDeleteModal = false;
    selectedProduct: UserProduct | null = null;

    // Forms
    editProductForm: FormGroup;

    // Image upload
    selectedImage: File | null = null;
    imagePreview: string | null = null;

    // Toast notifications
    showToast = false;
    toastMessage = '';
    toastType: 'success' | 'error' = 'success';

    constructor(
        private nutritionService: NutritionService,
        private fb: FormBuilder
    ) {
        this.editProductForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            manufacturer: [''],
            description: [''],
            calories: [0, [Validators.required, Validators.min(0)]],
            protein: [0, [Validators.required, Validators.min(0)]],
            fat: [0, [Validators.required, Validators.min(0)]],
            carbohydrate: [0, [Validators.required, Validators.min(0)]],
            fiber: [0, [Validators.min(0)]],
            sugar: [0, [Validators.min(0)]],
            sodium: [0, [Validators.min(0)]],
            potassium: [0, [Validators.min(0)]],
            cholesterol: [0, [Validators.min(0)]],
            vitamin_a: [0, [Validators.min(0)]],
            vitamin_c: [0, [Validators.min(0)]],
            calcium: [0, [Validators.min(0)]],
            iron: [0, [Validators.min(0)]]
        });
    }

    ngOnInit(): void {
        this.loadProducts();
    }

    loadProducts(): void {
        this.isLoading = true;
        this.error = '';
        console.log('Loading user products...');
        this.nutritionService.getUserProducts().subscribe({
            next: (products) => {
                console.log('User products loaded:', products);
                this.userProducts = products;
                this.applyFilters();
                this.isLoading = false;
            },
            error: (error) => {
                this.error = 'Ошибка загрузки продуктов';
                this.isLoading = false;
                console.error('Error loading user products:', error);
            }
        });
    }

    // Product operations
    editProduct(product: UserProduct): void {
        this.selectedProduct = product;
        this.populateEditForm(product);
        this.showEditModal = true;
    }

    populateEditForm(product: UserProduct): void {
        this.editProductForm.patchValue({
            name: product.name,
            manufacturer: product.manufacturer || '',
            description: product.description || '',
            calories: product.calories || 0,
            protein: product.protein || 0,
            fat: product.fat || 0,
            carbohydrate: product.carbohydrate || 0,
            fiber: product.fiber || 0,
            sugar: product.sugar || 0,
            sodium: product.sodium || 0,
            potassium: product.potassium || 0,
            cholesterol: product.cholesterol || 0,
            vitamin_a: product.vitamin_a || 0,
            vitamin_c: product.vitamin_c || 0,
            calcium: product.calcium || 0,
            iron: product.iron || 0
        });

        // Reset image state
        this.selectedImage = null;
        this.imagePreview = null;
    }

    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedProduct = null;
        this.editProductForm.reset();
        this.selectedImage = null;
        this.imagePreview = null;
    }

    updateProduct(): void {
        if (this.editProductForm.valid && this.selectedProduct) {
            const formData = this.editProductForm.value;

            const productData = {
                name: formData.name.trim(),
                manufacturer: formData.manufacturer ? formData.manufacturer.trim() : null,
                description: formData.description ? formData.description.trim() : null,
                calories: Number(formData.calories),
                protein: Number(formData.protein),
                fat: Number(formData.fat),
                carbohydrate: Number(formData.carbohydrate),
                fiber: Number(formData.fiber),
                sugar: Number(formData.sugar),
                sodium: Number(formData.sodium),
                potassium: Number(formData.potassium),
                cholesterol: Number(formData.cholesterol),
                vitamin_a: Number(formData.vitamin_a),
                vitamin_c: Number(formData.vitamin_c),
                calcium: Number(formData.calcium),
                iron: Number(formData.iron)
            };

            this.nutritionService.updateUserProduct(this.selectedProduct.id, productData).subscribe({
                next: (product) => {
                    if (this.selectedImage) {
                        this.nutritionService.uploadProductImage(product.id, this.selectedImage).subscribe({
                            next: () => {
                                this.showSuccessMessage('Продукт обновлен успешно');
                                this.closeEditModal();
                                this.loadProducts();
                            },
                            error: (error) => {
                                console.error('Error uploading image:', error);
                                this.showSuccessMessage('Продукт обновлен, но изображение не загружено');
                                this.closeEditModal();
                                this.loadProducts();
                            }
                        });
                    } else {
                        this.showSuccessMessage('Продукт обновлен успешно');
                        this.closeEditModal();
                        this.loadProducts();
                    }
                },
                error: (error) => {
                    console.error('Error updating product:', error);
                    this.showErrorMessage('Ошибка обновления продукта');
                }
            });
        } else {
            this.markFormGroupTouched(this.editProductForm);
            this.showErrorMessage('Проверьте правильность заполнения формы');
        }
    }

    confirmDelete(product: UserProduct): void {
        this.selectedProduct = product;
        this.showDeleteModal = true;
    }

    deleteProduct(): void {
        if (this.selectedProduct) {
            this.nutritionService.deleteUserProduct(this.selectedProduct.id).subscribe({
                next: () => {
                    this.showSuccessMessage('Продукт удален');
                    this.showDeleteModal = false;
                    this.selectedProduct = null;
                    this.loadProducts();
                },
                error: (error) => {
                    console.error('Error deleting product:', error);
                    this.showErrorMessage('Ошибка удаления продукта');
                }
            });
        }
    }

    closeDeleteModal(): void {
        this.showDeleteModal = false;
        this.selectedProduct = null;
    }

    // Quick action methods
    quickAddToIntake(product: UserProduct, amount: number = 100): void {
        const data = {
            user_product_id: product.id,
            amount: amount,
            unit: 'g'
        };

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
        
        // If we're editing a product with an existing image, mark it for deletion
        if (this.showEditModal && this.selectedProduct?.image_url) {
            this.deleteExistingImage();
        }
    }

    deleteExistingImage(): void {
        if (this.selectedProduct?.id) {
            this.nutritionService.deleteProductImage(this.selectedProduct.id).subscribe({
                next: () => {
                    this.showSuccessMessage('Изображение удалено успешно');
                    if (this.selectedProduct) {
                        this.selectedProduct.image_url = undefined;
                    }
                },
                error: (error) => {
                    console.error('Error deleting image:', error);
                    this.showErrorMessage('Ошибка удаления изображения');
                }
            });
        }
    }

    // Toast notifications
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
            } else {
                control?.markAsTouched();
            }
        });
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

    // Filter and sort methods
    applyFilters(): void {
        let filtered = [...this.userProducts];

        // Apply search filter
        if (this.searchFilter.trim()) {
            const query = this.searchFilter.toLowerCase();
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(query) ||
                (product.description && product.description.toLowerCase().includes(query)) ||
                (product.manufacturer && product.manufacturer.toLowerCase().includes(query))
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
                    aValue = a.calories;
                    bValue = b.calories;
                    break;
                case 'protein':
                    aValue = a.protein;
                    bValue = b.protein;
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

        this.filteredProducts = filtered;
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
    getTotalProducts(): number {
        return this.userProducts.length;
    }

    getHighProteinProducts(): number {
        return this.userProducts.filter(product => product.protein > 10).length;
    }

    getLowCalorieProducts(): number {
        return this.userProducts.filter(product => product.calories < 100).length;
    }

    getAverageCalories(): number {
        if (this.userProducts.length === 0) return 0;
        
        const totalCalories = this.userProducts.reduce((sum, product) => sum + (product.calories || 0), 0);
        const average = totalCalories / this.userProducts.length;
        
        return isNaN(average) ? 0 : Math.round(average);
    }
}
