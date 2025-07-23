import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {AuthService, RoleData, User} from "../../../../core/services";

@Component({
  selector: 'app-patient-header',
  templateUrl: './patient-header.component.html',
  styleUrls: ['./patient-header.component.scss']
})
export class PatientHeaderComponent implements OnInit, OnDestroy {
  notificationCount = 0;
  messageCount = 0;
  hasMultipleRoles = false;

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