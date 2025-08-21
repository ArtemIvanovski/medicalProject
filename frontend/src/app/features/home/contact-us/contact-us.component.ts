import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ContactService } from '../../../core/services/contact.service';
import { NewsletterResponse, ContactFormResponse } from '../../../core/models/newsletter.models';
import { forkJoin } from 'rxjs';

declare var Swal: any;

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  newsletter: boolean;
}

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.scss'
})
export class ContactUsComponent implements OnInit {

  formData: ContactFormData = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    newsletter: false
  };

  // Validation error messages
  validationErrors: { [key: string]: string } = {};
  isSubmitting = false;

  constructor(
    private titleService: Title,
    private newsletterService: NewsletterService,
    private contactService: ContactService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Связаться с нами');
  }

  onSubmit(): void {
    this.clearMessages();
    
    if (this.validateForm()) {
      this.isSubmitting = true;
      
      const contactData = {
        name: this.formData.name,
        email: this.formData.email,
        phone: this.formData.phone,
        subject: this.formData.subject,
        message: this.formData.message
      };

      // Исправленная логика отправки:
      // Когда чекбокс отмечен (true) - пользователь хочет подписаться: контакт + подписка
      // Когда чекбокс НЕ отмечен (false) - пользователь НЕ хочет подписываться: только контакт
      if (this.formData.newsletter) {
        // Чекбокс отмечен - отправляем два запроса: контакт + подписка
        console.log('Чекбокс отмечен - отправляем контакт + подписку');
        forkJoin({
          contact: this.contactService.sendContactMessage(contactData),
          newsletter: this.newsletterService.subscribe(this.formData.email)
        }).subscribe({
          next: (results) => {
            this.isSubmitting = false;
            this.handleContactSuccess(results.contact);
            console.log('Newsletter result:', results.newsletter);
            this.resetForm();
          },
          error: (error) => {
            this.isSubmitting = false;
            console.error('Error in forkJoin:', error);
            this.handleContactError(error);
          }
        });
      } else {
        // Чекбокс НЕ отмечен - отправляем только контакт
        console.log('Чекбокс НЕ отмечен - отправляем только контакт');
        this.contactService.sendContactMessage(contactData).subscribe({
          next: (response: ContactFormResponse) => {
            this.isSubmitting = false;
            this.handleContactSuccess(response);
            this.resetForm();
          },
          error: (error) => {
            this.isSubmitting = false;
            this.handleContactError(error);
          }
        });
      }
    }
  }

  private validateForm(): boolean {
    this.validationErrors = {};
    let isValid = true;

    // Проверка имени
    if (!this.formData.name.trim()) {
      this.validationErrors['name'] = 'Пожалуйста, введите ваше имя.';
      isValid = false;
    }

    // Проверка email
    if (!this.formData.email.trim()) {
      this.validationErrors['email'] = 'Пожалуйста, введите email адрес.';
      isValid = false;
    } else if (!this.newsletterService.isValidEmail(this.formData.email)) {
      this.validationErrors['email'] = 'Пожалуйста, введите корректный email адрес.';
      isValid = false;
    } else if (this.newsletterService.isSuspiciousDomain(this.formData.email)) {
      this.validationErrors['email'] = 'Временные email адреса не поддерживаются.';
      isValid = false;
    }

    // Проверка телефона
    if (!this.formData.phone.trim()) {
      this.validationErrors['phone'] = 'Пожалуйста, введите номер телефона.';
      isValid = false;
    } else if (!this.isValidPhone(this.formData.phone)) {
      this.validationErrors['phone'] = 'Пожалуйста, введите корректный номер телефона.';
      isValid = false;
    }

    // Проверка темы
    if (!this.formData.subject.trim()) {
      this.validationErrors['subject'] = 'Пожалуйста, введите тему сообщения.';
      isValid = false;
    }

    // Проверка сообщения
    if (!this.formData.message.trim()) {
      this.validationErrors['message'] = 'Пожалуйста, введите ваше сообщение.';
      isValid = false;
    }

    return isValid;
  }

  private isValidPhone(phone: string): boolean {
    // Проверка для белорусских номеров телефонов
    const phoneRegex = /^(\+375|375)?(29|33|44|25)\d{7}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone);
  }

  private handleContactSuccess(response: ContactFormResponse): void {
    if (response.success) {
      this.showAlert(response.message || 'Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.', 'success');
    } else {
      this.showAlert(response.message || 'Произошла ошибка при отправке сообщения.', 'error');
    }
  }

  private handleContactError(error: any): void {
    console.error('❌ Ошибка отправки контактной формы:', error);
    if (error.status === 429) {
      this.showAlert('Слишком много запросов. Попробуйте позже.', 'error');
    } else if (error.error?.errors) {
      // Показываем первую ошибку валидации
      const firstError = Object.values(error.error.errors)[0];
      if (Array.isArray(firstError) && firstError.length > 0) {
        this.showAlert(firstError[0], 'error');
      } else {
        this.showAlert('Ошибка валидации данных.', 'error');
      }
    } else if (error.error?.message) {
      this.showAlert(error.error.message, 'error');
    } else {
      this.showAlert('Произошла ошибка при отправке сообщения. Попробуйте позже.', 'error');
    }
  }

  private clearMessages(): void {
    this.validationErrors = {};
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

  private resetForm(): void {
    this.formData = {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      newsletter: false
    };
    this.validationErrors = {};
  }

  // Геттеры для проверки ошибок валидации
  hasError(field: string): boolean {
    return !!this.validationErrors[field];
  }

  getError(field: string): string {
    return this.validationErrors[field] || '';
  }

  // Метод для отладки изменения чекбокса
  onNewsletterChange(): void {
    console.log('Newsletter checkbox changed:', this.formData.newsletter);
  }
}
