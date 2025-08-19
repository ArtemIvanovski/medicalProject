import {Component} from '@angular/core';
import {NewsletterService} from '../../../core/services/newsletter.service';
import {NewsletterResponse} from "../../../core/models/newsletter.models";

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
    emailForNewsletter = '';
    isSubmitting = false;
    message = '';
    messageType: 'success' | 'error' | '' = '';

    constructor(private newsletterService: NewsletterService) {
    }

    subscribeNewsletter(): void {
        this.message = '';
        this.messageType = '';

        if (!this.emailForNewsletter.trim()) {
            this.showMessage('Пожалуйста, введите email адрес.', 'error');
            return;
        }

        if (!this.newsletterService.isValidEmail(this.emailForNewsletter)) {
            this.showMessage('Пожалуйста, введите корректный email адрес.', 'error');
            return;
        }

        if (this.newsletterService.isSuspiciousDomain(this.emailForNewsletter)) {
            this.showMessage('Временные email адреса не поддерживаются.', 'error');
            return;
        }

        this.isSubmitting = true;

        this.newsletterService.subscribe(this.emailForNewsletter).subscribe({
            next: (response: NewsletterResponse) => {
                this.isSubmitting = false;

                if (response.success) {
                    this.showMessage(response.message, 'success');
                    this.emailForNewsletter = '';
                } else {
                    this.showMessage(response.message, 'error');
                }
            },
            error: (error: any) => {
                this.isSubmitting = false;
                console.error('Newsletter subscription error:', error);

                if (error.status === 429) {
                    this.showMessage('Слишком много запросов. Попробуйте позже.', 'error');
                } else if (error.error?.message) {
                    this.showMessage(error.error.message, 'error');
                } else {
                    this.showMessage('Произошла ошибка. Попробуйте позже.', 'error');
                }
            }
        });
    }

    private showMessage(text: string, type: 'success' | 'error'): void {
        this.message = text;
        this.messageType = type;

        setTimeout(() => {
            this.message = '';
            this.messageType = '';
        }, 5000);
    }

}