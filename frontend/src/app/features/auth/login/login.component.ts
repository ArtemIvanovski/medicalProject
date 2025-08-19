import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {AuthService} from "../../../core/services/auth.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: []
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  nextUrl?: string;
  formErrors: string[] = [];

  constructor(
      private fb: FormBuilder,
      private router: Router,
      private route: ActivatedRoute,
      private titleService: Title,
      private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Вход');

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      remember: [false]
    });

    // Получаем next URL из query параметров
    this.route.queryParams.subscribe(params => {
      this.nextUrl = params['next'] || undefined;
    });
  }

  onSubmit(): void {
    this.formErrors = [];

    if (this.loginForm.valid) {
      this.isLoading = true;

      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Авторизация успешна!', response);

          // Если нужен выбор роли, перенаправляем на страницу выбора
          if (response.needs_role_selection) {
            const queryParams: any = {};
            if (this.nextUrl) {
              queryParams.next = this.nextUrl;
            }
            this.router.navigate(['/profile-selection'], { queryParams });
          } else {
            // Если только одна роль, сразу переходим на dashboard роли
            const userRole = response.role_data[0]?.name;
            if (userRole) {
              this.redirectToRoleDashboard(userRole);
            } else {
              this.router.navigate([this.nextUrl || '/dashboard']);
            }
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.formErrors = ['Неверный email или пароль'];
          console.error('Login failed:', error);
        }
      });
    } else {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  private redirectToRoleDashboard(roleName: string): void {
    const dashboardRoutes: { [key: string]: string } = {
      'PATIENT': '/patient/dashboard',
      'DOCTOR': '/doctor/dashboard',
      'TRUSTED_PERSON': '/trusted/dashboard',
      'ADMIN': '/admin/dashboard'
    };

    const route = dashboardRoutes[roleName] || '/dashboard';
    this.router.navigate([route]);
  }
}