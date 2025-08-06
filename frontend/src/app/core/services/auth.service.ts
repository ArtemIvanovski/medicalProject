import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import {InvitationValidation, LoginResponse, RegisterRequest, User} from "../models";


@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private isAuthenticatedSubject = new BehaviorSubject<boolean | null>(null);
    public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

    public currentUserSubject = new BehaviorSubject<User | null>(null);
    private activeRoleSubject = new BehaviorSubject<string | null>(null);

    public currentUser$ = this.currentUserSubject.asObservable();
    public activeRole$ = this.activeRoleSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        this.initializeFromStorage();
    }

    private initializeFromStorage(): void {
        const token = this.getAccessToken();
        const activeRole = this.getActiveRole();

        console.log('Initializing auth from storage:', {
            hasToken: !!token,
            tokenExpired: token ? this.isTokenExpired(token) : 'no token',
            activeRole
        });

        if (token && !this.isTokenExpired(token)) {
            console.log('Valid token found, setting authenticated state');
            this.isAuthenticatedSubject.next(true);

            if (activeRole) {
                this.activeRoleSubject.next(activeRole);
            }

            setTimeout(() => this.loadCurrentUser(), 0);
        } else {
            console.log('No valid token, clearing auth state');
            this.clearAuthState();
            this.isAuthenticatedSubject.next(false);
        }
    }

    public isAuthenticated(): boolean {
        const token = this.getAccessToken();
        const result = token != null && !this.isTokenExpired(token);
        console.log('Sync auth check:', { hasToken: !!token, isValid: result });
        return result;
    }

    public initializeAuthenticatedState(): void {
        if (this.isAuthenticated()) {
            console.log('Force setting authenticated state');
            this.isAuthenticatedSubject.next(true);
        }
    }

    public loadUserData(): void {
    }

    login(email: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.authApiUrl}/login/`, {
            email,
            password
        }).pipe(
            tap(response => {
                console.log('Login successful, setting tokens and state');
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
                console.log('Logout, clearing all auth state');
                this.clearAuthState();
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
        console.log('Setting active role:', roleName);
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

    loadCurrentUser(): Observable<User> {
        console.log('Loading current user data');
        return this.http.get<User>(`${environment.authApiUrl}/me/`).pipe(
            tap({
                next: user => {
                    console.log('User data loaded:', user.email);
                    this.currentUserSubject.next(user);
                    this.isAuthenticatedSubject.next(true);
                },
                error: (error) => {
                    console.error('Failed to load user data:', error);
                    if (error.status === 401) {
                        console.log('401 error, clearing auth state');
                        this.clearAuthState();
                    }
                }
            })
        );
    }

    private clearAuthState(): void {
        this.clearTokens();
        this.clearActiveRole();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        this.activeRoleSubject.next(null);
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

    public isTokenExpired(token: string): boolean {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const isExpired = Date.now() >= payload.exp * 1000;
            console.log('Token expiry check:', {
                exp: payload.exp,
                now: Math.floor(Date.now() / 1000),
                isExpired
            });
            return isExpired;
        } catch (error) {
            console.error('Error parsing token:', error);
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