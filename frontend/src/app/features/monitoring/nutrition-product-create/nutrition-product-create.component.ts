import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NutritionService } from '../../../core/services';

@Component({
    selector: 'app-nutrition-product-create',
    templateUrl: './nutrition-product-create.component.html',
    styleUrls: ['./nutrition-product-create.component.scss']
})
export class NutritionProductCreateComponent implements OnInit {
    createProductForm: FormGroup;
    isLoading = false;
    error = '';
    successMessage = '';

    // Image upload
    selectedImage: File | null = null;
    imagePreview: string | null = null;

    constructor(
        private fb: FormBuilder,
        private nutritionService: NutritionService,
        private titleService: Title,
        private router: Router
    ) {
        this.createProductForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            composition: [''],
            manufacturer: [''],
            protein: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
            fat: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
            carbohydrate: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
        });

        // Subscribe to nutrition changes to auto-calculate calories
        this.createProductForm.get('protein')?.valueChanges.subscribe(() => this.updateCalculatedCalories());
        this.createProductForm.get('fat')?.valueChanges.subscribe(() => this.updateCalculatedCalories());
        this.createProductForm.get('carbohydrate')?.valueChanges.subscribe(() => this.updateCalculatedCalories());
    }

    ngOnInit(): void {
        this.titleService.setTitle('Создание продукта');
    }

    createProduct(): void {
        if (this.createProductForm.valid) {
            this.isLoading = true;
            this.error = '';
            this.successMessage = '';

            const formData = this.createProductForm.value;
            
            // Validate nutrition values sum
            const totalNutrition = Number(formData.protein) + Number(formData.fat) + Number(formData.carbohydrate);
            if (totalNutrition > 100) {
                this.showErrorMessage('Сумма белков, жиров и углеводов не может превышать 100г');
                this.isLoading = false;
                return;
            }

            const calculatedCalories = this.getCalculatedCaloriesFromMacros();
            
            const productData = {
                name: formData.name.trim(),
                composition: formData.composition ? formData.composition.trim() : '',
                manufacturer: formData.manufacturer ? formData.manufacturer.trim() : '',
                calories: calculatedCalories,
                protein: Number(formData.protein),
                fat: Number(formData.fat),
                carbohydrate: Number(formData.carbohydrate)
            };

            this.nutritionService.createUserProduct(productData).subscribe({
                next: (product) => {
                    console.log('Product created with response:', product);
                    console.log('Product ID:', product.id);
                    console.log('Selected image:', this.selectedImage);
                    
                    if (this.selectedImage && product.id) {
                        console.log('Uploading image for product ID:', product.id);
                        this.nutritionService.uploadProductImage(product.id, this.selectedImage).subscribe({
                            next: () => {
                                console.log('Image uploaded successfully');
                                this.showSuccessMessage('Продукт создан успешно');
                                this.handleSuccessCreation();
                            },
                            error: (error: any) => {
                                console.error('Error uploading image:', error);
                                this.showSuccessMessage('Продукт создан, но изображение не загружено');
                                this.handleSuccessCreation();
                            }
                        });
                    } else {
                        if (!product.id) {
                            console.error('Product created but ID is missing:', product);
                        }
                        this.showSuccessMessage('Продукт создан успешно');
                        this.handleSuccessCreation();
                    }
                },
                error: (error) => {
                    console.error('Error creating product:', error);
                    this.handleApiError(error, 'Ошибка создания продукта');
                    this.isLoading = false;
                }
            });
        } else {
            this.markFormGroupTouched(this.createProductForm);
            this.showErrorMessage('Проверьте правильность заполнения формы');
        }
    }

    private handleSuccessCreation(): void {
        this.isLoading = false;
        // Redirect to my products page after a delay
        setTimeout(() => {
            this.router.navigate(['/patient/monitoring/nutrition/my-products']);
        }, 2000);
    }

    resetForm(): void {
        this.createProductForm.reset({
            name: '',
            composition: '',
            manufacturer: '',
            protein: 0,
            fat: 0,
            carbohydrate: 0
        });
        this.removeImage();
        this.error = '';
        this.successMessage = '';
        this.markFormGroupUntouched(this.createProductForm);
    }

    // Image handling
    onImageSelected(event: any): void {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showErrorMessage('Пожалуйста, выберите изображение');
                return;
            }

            // Validate file size (5MB max)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                this.showErrorMessage('Размер файла не должен превышать 5MB');
                return;
            }

            this.selectedImage = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.imagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
            
            // Clear any previous error messages
            this.error = '';
        }
    }

    removeImage(): void {
        this.selectedImage = null;
        this.imagePreview = null;
        
        // Reset file input
        const fileInput = document.getElementById('productImage') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
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
            } else {
                control?.markAsTouched();
            }
        });
    }

    private markFormGroupUntouched(formGroup: FormGroup): void {
        Object.keys(formGroup.controls).forEach(key => {
            const control = formGroup.get(key);
            if (control instanceof FormGroup) {
                this.markFormGroupUntouched(control);
            } else {
                control?.markAsUntouched();
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
        } else if (error.status === 400) {
            errorMessage = 'Некорректные данные. Проверьте заполнение формы.';
        } else if (error.status === 401) {
            errorMessage = 'Необходима авторизация';
        } else if (error.status === 403) {
            errorMessage = 'Недостаточно прав для выполнения операции';
        } else if (error.status === 500) {
            errorMessage = 'Внутренняя ошибка сервера. Попробуйте позже.';
        }
        
        this.showErrorMessage(errorMessage);
    }

    private showSuccessMessage(message: string): void {
        this.successMessage = message;
        this.error = '';
        console.log('Success:', message);
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
            this.successMessage = '';
        }, 5000);
    }

    private showErrorMessage(message: string): void {
        this.error = message;
        this.successMessage = '';
        console.error('Error:', message);
        
        // Auto-hide error message after 10 seconds
        setTimeout(() => {
            this.error = '';
        }, 10000);
    }

    // Form validation helpers
    isFieldInvalid(fieldName: string): boolean {
        const field = this.createProductForm.get(fieldName);
        return !!(field && field.invalid && field.touched);
    }

    getFieldError(fieldName: string): string {
        const field = this.createProductForm.get(fieldName);
        if (field && field.errors && field.touched) {
            if (field.errors['required']) {
                return 'Это поле обязательно для заполнения';
            }
            if (field.errors['minlength']) {
                return `Минимум ${field.errors['minlength'].requiredLength} символов`;
            }
            if (field.errors['min']) {
                return `Минимальное значение: ${field.errors['min'].min}`;
            }
            if (field.errors['max']) {
                return `Максимальное значение: ${field.errors['max'].max}`;
            }
        }
        return '';
    }

    // Calculated nutrition helpers
    getCalculatedCaloriesFromMacros(): number {
        const protein = Number(this.createProductForm.get('protein')?.value) || 0;
        const fat = Number(this.createProductForm.get('fat')?.value) || 0;
        const carbohydrate = Number(this.createProductForm.get('carbohydrate')?.value) || 0;
        
        return (protein * 4) + (fat * 9) + (carbohydrate * 4);
    }

    getNutritionTotalWeight(): number {
        const protein = Number(this.createProductForm.get('protein')?.value) || 0;
        const fat = Number(this.createProductForm.get('fat')?.value) || 0;
        const carbohydrate = Number(this.createProductForm.get('carbohydrate')?.value) || 0;
        
        return protein + fat + carbohydrate;
    }

    isNutritionValid(): boolean {
        return this.getNutritionTotalWeight() <= 100;
    }

    goToMyProducts(): void {
        this.router.navigate(['/patient/monitoring/nutrition/my-products']);
    }

    canDeactivate(): boolean {
        if (this.createProductForm.dirty && !this.successMessage) {
            return confirm('У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?');
        }
        return true;
    }

    private updateCalculatedCalories(): void {
        const calculatedCalories = this.getCalculatedCaloriesFromMacros();
        
        const currentCalories = Number(this.createProductForm.get('calories')?.value) || 0;
        
        if (Math.abs(currentCalories - calculatedCalories) > 0.1) {
            this.createProductForm.get('calories')?.setValue(
                Math.round(calculatedCalories * 10) / 10, 
                { emitEvent: false }
            );
        }
        
        this.createProductForm.get('calories')?.updateValueAndValidity();
    }
}
