// src/app/features/auth/register/register.component.ts

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html'
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;
  formErrors: string[] = [];
  invitationToken?: string;
  invitationValid = false;
  invitationType?: string;
  nextUrl?: string;

  constructor(
      private fb: FormBuilder,
      private router: Router,
      private route: ActivatedRoute,
      private titleService: Title,
      private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Регистрация');

    // Получаем токен приглашения из URL
    this.route.queryParams.subscribe(params => {
      this.invitationToken = params['token'];
      this.nextUrl = params['next']; // <- Добавьте эту строку

      if (this.invitationToken) {
        this.validateInvitation();
      } else {
        this.router.navigate(['/']);
      }
    });

    this.initializeForm();
  }

  private initializeForm(): void {
    this.registerForm = this.fb.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      phone_number: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['', [Validators.required]],
      agreeToTerms: [false, [Validators.requiredTrue]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  private validateInvitation(): void {
    if (!this.invitationToken) return;

    this.authService.validateInvitation(this.invitationToken).subscribe({
      next: (response) => {
        this.invitationValid = response.valid;
        this.invitationType = response.invitation_type;

        if (!response.valid) {
          // Приглашение недействительно
          this.router.navigate(['/invitation-invalid']);
        }
      },
      error: () => {
        this.router.navigate(['/invitation-invalid']);
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): { [key: string]: any } | null {
    const password = control.get('password');
    const passwordConfirm = control.get('password_confirm');

    if (password && passwordConfirm && password.value !== passwordConfirm.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    this.formErrors = [];

    if (this.registerForm.valid && this.invitationToken) {
      this.isLoading = true;

      const formData = {
        ...this.registerForm.value,
        invitation_token: this.invitationToken
      };

      // Удаляем поля, которых нет в API
      delete formData.password_confirm;
      delete formData.agreeToTerms;

      this.authService.register(formData).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Регистрация успешна!', response);

          // Перенаправляем в зависимости от роли
          const userRoles = response.user.roles;
          if (userRoles.includes('ADMIN')) {
            this.router.navigate(['/admin']);
          } else if (userRoles.includes('DOCTOR')) {
            this.router.navigate(['/doctor']);
          } else if (userRoles.includes('PATIENT')) {
            this.router.navigate(['/patient']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleRegistrationError(error);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private handleRegistrationError(error: any): void {
    if (error.error) {
      // Обрабатываем ошибки валидации с сервера
      const serverErrors = error.error;
      this.formErrors = [];

      Object.keys(serverErrors).forEach(key => {
        if (Array.isArray(serverErrors[key])) {
          this.formErrors.push(...serverErrors[key]);
        } else {
          this.formErrors.push(serverErrors[key]);
        }
      });
    } else {
      this.formErrors = ['Произошла ошибка при регистрации'];
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registerForm.controls).forEach(key => {
      this.registerForm.get(key)?.markAsTouched();
    });
    this.registerForm.markAsTouched();
  }
}