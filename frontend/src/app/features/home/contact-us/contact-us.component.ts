import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { NewsletterResponse } from '../../../core/models/newsletter.models';

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
    private newsletterService: NewsletterService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Связаться с нами');
  }

  onSubmit(): void {
    this.clearMessages();
    
    if (this.validateForm()) {
      this.isSubmitting = true;
      
      // Логика для подписки на рассылку
      if (this.formData.newsletter) {
        this.subscribeToNewsletter();
      }
      
      // Основная логика отправки формы
      console.log('=== ФОРМА ОТПРАВЛЕНА ===');
      console.log('Данные формы:', this.formData);
      console.log('Подписка на рассылку:', this.formData.newsletter ? 'Да' : 'Нет');
      console.log('========================');
      
      // Имитация отправки
      setTimeout(() => {
        this.isSubmitting = false;
        this.showAlert('Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.', 'success');
        this.resetForm();
      }, 1000);
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

  private subscribeToNewsletter(): void {
    this.newsletterService.subscribe(this.formData.email).subscribe({
      next: (response: NewsletterResponse) => {
        if (response.success) {
          this.showAlert(response.message, 'success');
        } else {
          this.showAlert(response.message, 'error');
        }
      },
      error: (error: any) => {
        console.error('❌ Ошибка подписки на рассылку:', error);
        if (error.status === 429) {
          this.showAlert('Слишком много запросов. Попробуйте позже.', 'error');
        } else if (error.error?.errors?.email && error.error.errors.email.length > 0) {
          // Извлекаем конкретное сообщение об ошибке email
          this.showAlert(error.error.errors.email[0], 'error');
        } else if (error.error?.message) {
          this.showAlert(error.error.message, 'error');
        } else {
          this.showAlert('Произошла ошибка при подписке на рассылку.', 'error');
        }
      }
    });
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
}
