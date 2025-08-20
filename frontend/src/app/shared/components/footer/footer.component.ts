import {Component} from '@angular/core';
import {NewsletterService} from '../../../core/services/newsletter.service';
import {NewsletterResponse} from "../../../core/models/newsletter.models";

declare var Swal: any;

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
    emailForNewsletter = '';
    isSubmitting = false;

    constructor(private newsletterService: NewsletterService) {
    }

    subscribeNewsletter(): void {
        if (!this.emailForNewsletter.trim()) {
            this.showAlert('Пожалуйста, введите email адрес.', 'error');
            return;
        }

        if (!this.newsletterService.isValidEmail(this.emailForNewsletter)) {
            this.showAlert('Пожалуйста, введите корректный email адрес.', 'error');
            return;
        }

        if (this.newsletterService.isSuspiciousDomain(this.emailForNewsletter)) {
            this.showAlert('Временные email адреса не поддерживаются.', 'error');
            return;
        }

        this.isSubmitting = true;

        this.newsletterService.subscribe(this.emailForNewsletter).subscribe({
            next: (response: NewsletterResponse) => {
                this.isSubmitting = false;

                if (response.success) {
                    this.showAlert(response.message, 'success');
                    this.emailForNewsletter = '';
                } else {
                    this.showAlert(response.message, 'error');
                }
            },
            error: (error: any) => {
                this.isSubmitting = false;
                console.error('Newsletter subscription error:', error);

                if (error.status === 429) {
                    this.showAlert('Слишком много запросов. Попробуйте позже.', 'error');
                } else if (error.error?.errors?.email && error.error.errors.email.length > 0) {
                    // Извлекаем конкретное сообщение об ошибке email
                    this.showAlert(error.error.errors.email[0], 'error');
                } else if (error.error?.message) {
                    this.showAlert(error.error.message, 'error');
                } else {
                    this.showAlert('Произошла ошибка. Попробуйте позже.', 'error');
                }
            }
        });
    }

    private showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                icon: type,
                title: message
            });
        }
    }

}