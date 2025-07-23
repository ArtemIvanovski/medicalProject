import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface RoleData {
  name: string;
  display_name: string;
  icon: string;
  notifications: number;
  messages: number;
}

@Component({
  selector: 'app-profile-selection',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile-selection.component.html',
  styleUrls: ['./profile-selection.component.scss']
})
export class ProfileSelectionComponent implements OnInit {
  roleDataList: RoleData[] = [];
  nextUrl?: string;
  roleNeeded?: string;
  isLoading = false;

  constructor(
      private router: Router,
      private route: ActivatedRoute,
      private titleService: Title,
      private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Выбор профиля');

    this.route.queryParams.subscribe(params => {
      this.nextUrl = params['next'];
      this.roleNeeded = params['role_needed'];
    });

    this.loadUserRoles();
  }

  private loadUserRoles(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user && user.role_data) {
        this.roleDataList = user.role_data;

        // Если только одна роль, сразу переходим
        if (this.roleDataList.length === 1) {
          this.chooseRole(this.roleDataList[0].name);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  chooseRole(roleName: string): void {
    this.isLoading = true;

    this.authService.setActiveRole(roleName).subscribe({
      next: () => {
        this.isLoading = false;

        if (this.nextUrl) {
          this.router.navigateByUrl(this.nextUrl);
        } else {
          this.redirectToRoleDashboard(roleName);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error setting active role:', error);
      }
    });
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

  getRussianPlural(count: number, forms: string[]): string {
    const num = Math.abs(count) % 100;
    if (num >= 11 && num <= 19) {
      return forms[2];
    }
    const n = num % 10;
    if (n === 1) return forms[0];
    if (n >= 2 && n <= 4) return forms[1];
    return forms[2];
  }

  getNotificationText(count: number): string {
    const forms = ['уведомление', 'уведомления', 'уведомлений'];
    return `${count} ${this.getRussianPlural(count, forms)}`;
  }

  getMessageText(count: number): string {
    const forms = ['сообщение', 'сообщения', 'сообщений'];
    return `${count} ${this.getRussianPlural(count, forms)}`;
  }

  getRoleInfoText(role: RoleData): string {
    if (role.notifications > 0 || role.messages > 0) {
      const parts = [];
      if (role.notifications > 0) {
        parts.push(this.getNotificationText(role.notifications));
      }
      if (role.messages > 0) {
        parts.push(this.getMessageText(role.messages));
      }
      return parts.join(', ');
    }
    return 'Стабильность тоже хорошо!';
  }
}