import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {RoleData, User} from "../../../../core/models";
import {AuthService} from "../../../../core/services";

@Component({
  selector: 'app-patient-header',
  templateUrl: './patient-header.component.html',
  styleUrls: ['./patient-header.component.scss']
})
export class PatientHeaderComponent implements OnInit, OnDestroy {
  notificationCount = 0;
  messageCount = 0;
  hasMultipleRoles = false;
  currentUrl = '';

  private subscriptions = new Subscription();

  constructor(
      private authService: AuthService,
      private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
        this.authService.currentUser$.subscribe((user: User | null) => {
          if (user) {
            this.hasMultipleRoles = user.roles.length > 1;

            const patientRoleData = user.role_data?.find((role: RoleData) => role.name === 'PATIENT');
            if (patientRoleData) {
              this.notificationCount = patientRoleData.notifications;
              this.messageCount = patientRoleData.messages;
            }
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

    this.loadNotificationCount();
    this.loadMessageCount();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadNotificationCount(): void {
    // TODO: реализовать
  }

  private loadMessageCount(): void {
    // TODO: реализовать
  }

  // Методы для проверки активности пунктов меню
  isDashboardActive(): boolean {
    return this.currentUrl === '/patient/dashboard' || this.currentUrl.includes('/patient/doctors') || this.currentUrl.includes('/patient/invite-doctor');
  }

  isMonitoringActive(): boolean {
    return this.currentUrl.includes('/patient/monitoring');
  }

  isNotificationsActive(): boolean {
    return this.currentUrl === '/patient/notifications';
  }

  isMessagesActive(): boolean {
    return this.currentUrl === '/patient/messages';
  }

  isDoctorActive(): boolean {
    return this.currentUrl === '/patient/doctor' || this.currentUrl.includes('/patient/doctors-list') || 
           this.currentUrl.includes('/patient/stop-access-doctor') || this.currentUrl.includes('/patient/restrict-doctor-list');
  }

  isTrustedPersonActive(): boolean {
    return this.currentUrl === '/patient/trusted-person' || this.currentUrl.includes('/patient/trusted-persons-list') || 
           this.currentUrl.includes('/patient/invite-trusted') || this.currentUrl.includes('/patient/stop-access-trusted') || 
           this.currentUrl.includes('/patient/restrict-trusted-list');
  }

  isSettingsActive(): boolean {
    return this.currentUrl.includes('/patient/settings') || this.currentUrl.includes('/patient/profile-settings') || 
           this.currentUrl.includes('/patient/access-settings') || this.currentUrl.includes('/patient/interface-settings') || 
           this.currentUrl.includes('/patient/sensor-settings');
  }

  switchProfile(): void {
    this.router.navigate(['/profile-selection']);
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