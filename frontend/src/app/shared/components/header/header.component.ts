import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services';
import { User } from '../../../core/models';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  currentUser: User | null = null;
  hasMultipleRoles = false;
  currentUrl = '';

  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Отслеживание авторизации
    this.subscriptions.add(
      this.authService.isAuthenticated$.subscribe((isAuth: boolean | null) => {
        this.isAuthenticated = !!isAuth;
      })
    );

    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user: User | null) => {
        this.currentUser = user;
        if (user) {
          this.hasMultipleRoles = user.roles.length > 1;
        }
      })
    );

    // Отслеживание изменений роута
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.currentUrl = event.url;
        }
      })
    );

    // Установка начального URL
    this.currentUrl = this.router.url;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToProfile(): void {
    const activeRole = this.authService.getActiveRole();
    if (activeRole) {
      // Преобразуем роль в нижний регистр для URL
      const roleForUrl = activeRole.toLowerCase();
      this.router.navigate([`/${roleForUrl}/dashboard`]);
    } else {
      // Fallback на patient если нет активной роли
      this.router.navigate(['/patient/dashboard']);
    }
  }

  switchProfile(): void {
    this.router.navigate(['/profile-selection']);
  }

  // Методы для проверки активности пунктов меню
  isHomeActive(): boolean {
    return this.currentUrl === '/home' || this.currentUrl === '/home/home' || this.currentUrl === '/';
  }

  isBlogActive(): boolean {
    return this.currentUrl.includes('/home/blogs');
  }

  isContactActive(): boolean {
    return this.currentUrl === '/home/contact_us';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Logout error:', error);
        this.router.navigate(['/login']);
      }
    });
  }
}