import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface RoleData {
    name: string;
    display_name: string;
    icon: string;
    notifications: number;
    messages: number;
}

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    phone_number: string;
    roles: string[];
    role_data?: RoleData[];
    active_role?: string;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    user: User;
    role_data: RoleData[];
    needs_role_selection: boolean;
    message: string;
}

export interface RegisterRequest {
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    password: string;
    invitation_token: string;
}

export interface InvitationValidation {
    valid: boolean;
    invitation_type?: string;
    expires_at?: string;
    target_role?: string;
    error?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    private activeRoleSubject = new BehaviorSubject<string | null>(null);

    public currentUser$ = this.currentUserSubject.asObservable();
    public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    public activeRole$ = this.activeRoleSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        this.initializeAuth();
    }

    private initializeAuth(): void {
        const token = this.getAccessToken();
        const activeRole = this.getActiveRole();

        if (token && !this.isTokenExpired(token)) {
            this.loadCurrentUser();
            if (activeRole) {
                this.activeRoleSubject.next(activeRole);
            }
        }
    }

    login(email: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.authApiUrl}/login/`, {
            email,
            password
        }).pipe(
            tap(response => {
                this.setTokens(response.access, response.refresh);

                const userWithRoles = {
                    ...response.user,
                    role_data: response.role_data
                };

                this.currentUserSubject.next(userWithRoles);
                this.isAuthenticatedSubject.next(true);

                if (!response.needs_role_selection && response.role_data.length === 1) {
                    const singleRole = response.role_data[0].name;
                    this.setActiveRoleLocal(singleRole);
                }
            })
        );
    }

    register(data: RegisterRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.authApiUrl}/register/`, data).pipe(
            tap(response => {
                this.setTokens(response.access, response.refresh);

                const userWithRoles = {
                    ...response.user,
                    role_data: response.role_data
                };

                this.currentUserSubject.next(userWithRoles);
                this.isAuthenticatedSubject.next(true);

                if (!response.needs_role_selection && response.role_data.length === 1) {
                    const singleRole = response.role_data[0].name;
                    this.setActiveRoleLocal(singleRole);
                }
            })
        );
    }

    logout(): Observable<any> {
        const refreshToken = this.getRefreshToken();
        return this.http.post(`${environment.authApiUrl}/logout/`, {
            refresh_token: refreshToken
        }).pipe(
            tap(() => {
                this.clearTokens();
                this.clearActiveRole();
                this.currentUserSubject.next(null);
                this.isAuthenticatedSubject.next(false);
                this.activeRoleSubject.next(null);
                this.router.navigate(['/login']);
            })
        );
    }

    setActiveRole(roleName: string): Observable<any> {
        return new Observable(observer => {
            const currentUser = this.currentUserSubject.value;
            if (currentUser && currentUser.roles.includes(roleName)) {
                this.setActiveRoleLocal(roleName);
                observer.next({ success: true });
                observer.complete();
            } else {
                observer.error({ error: 'Invalid role' });
            }
        });
    }

    private setActiveRoleLocal(roleName: string): void {
        localStorage.setItem('active_role', roleName);
        this.activeRoleSubject.next(roleName);

        const currentUser = this.currentUserSubject.value;
        if (currentUser) {
            this.currentUserSubject.next({
                ...currentUser,
                active_role: roleName
            });
        }
    }

    validateInvitation(token: string): Observable<InvitationValidation> {
        return this.http.get<InvitationValidation>(`${environment.authApiUrl}/invitations/validate/`, {
            params: { token }
        });
    }

    refreshToken(): Observable<{access: string}> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            return throwError(() => new Error('No refresh token'));
        }

        return this.http.post<{access: string}>(`${environment.authApiUrl}/token/refresh/`, {
            refresh: refreshToken
        }).pipe(
            tap(response => {
                localStorage.setItem('access_token', response.access);
            })
        );
    }

    private loadCurrentUser(): void {
        this.http.get<User>(`${environment.authApiUrl}/me/`)
            .subscribe({
                next: user => {
                    this.currentUserSubject.next(user);
                    this.isAuthenticatedSubject.next(true);
                },
                error: () => {
                    this.clearTokens();
                    this.clearActiveRole();
                    this.currentUserSubject.next(null);
                    this.isAuthenticatedSubject.next(false);
                    this.activeRoleSubject.next(null);
                }
            });
    }

    private setTokens(access: string, refresh: string): void {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
    }

    private clearTokens(): void {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    private clearActiveRole(): void {
        localStorage.removeItem('active_role');
    }

    getAccessToken(): string | null {
        return localStorage.getItem('access_token');
    }

    getRefreshToken(): string | null {
        return localStorage.getItem('refresh_token');
    }

    getActiveRole(): string | null {
        return localStorage.getItem('active_role');
    }

    private isTokenExpired(token: string): boolean {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return Date.now() >= payload.exp * 1000;
        } catch {
            return true;
        }
    }

    hasRole(role: string): boolean {
        const user = this.currentUserSubject.value;
        return user?.roles.includes(role) || false;
    }

    hasAnyRole(roles: string[]): boolean {
        const user = this.currentUserSubject.value;
        if (!user) return false;
        return roles.some(role => user.roles.includes(role));
    }

    isActiveRole(role: string): boolean {
        return this.activeRoleSubject.value === role;
    }

    needsRoleSelection(): boolean {
        const user = this.currentUserSubject.value;
        return !!(user?.roles && user.roles.length > 1 && !this.getActiveRole());
    }
}