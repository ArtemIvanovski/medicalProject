import { Component, OnInit } from '@angular/core';
import {AuthService} from "./core/services";

@Component({
    selector: 'app-debug-auth',
    template: `
    <div style="position: fixed; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc; z-index: 9999;">
      <h4>Auth Debug</h4>
      <div>Token exists: {{ hasToken }}</div>
      <div>Token expired: {{ isTokenExpired }}</div>
      <div>Is Authenticated (sync): {{ isAuthenticatedSync }}</div>
      <div>Is Authenticated (async): {{ isAuthenticatedAsync }}</div>
      <div>Current User: {{ currentUser?.email || 'null' }}</div>
      <div>Active Role: {{ activeRole || 'null' }}</div>
      <button (click)="refreshDebugInfo()">Refresh</button>
    </div>
  `
})
export class DebugAuthComponent implements OnInit {
    hasToken = false;
    isTokenExpired = true;
    isAuthenticatedSync = false;
    isAuthenticatedAsync: boolean | null = null; // Изменено на boolean | null
    currentUser: any = null;
    activeRole: string | null = null;

    constructor(private authService: AuthService) {}

    ngOnInit() {
        this.refreshDebugInfo();

        this.authService.currentUser$.subscribe(user => {
            this.currentUser = user;
        });

        this.authService.isAuthenticated$.subscribe(isAuth => {
            this.isAuthenticatedAsync = isAuth; // Теперь принимает boolean | null
        });

        this.authService.activeRole$.subscribe(role => {
            this.activeRole = role;
        });
    }

    refreshDebugInfo() {
        const token = this.authService.getAccessToken();
        this.hasToken = !!token;
        this.isTokenExpired = token ? this.authService.isTokenExpired(token) : true;
        this.isAuthenticatedSync = this.authService.isAuthenticated();
    }
}