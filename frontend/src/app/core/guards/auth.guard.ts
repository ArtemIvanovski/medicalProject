// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, map, take, of, switchMap } from 'rxjs';
import {catchError, filter} from "rxjs/operators";
import {AuthService} from "../services";

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ): Observable<boolean> {
        console.log('AuthGuard check for:', state.url);

        return this.authService.isAuthenticated$.pipe(
            filter(authenticated => authenticated !== null), // Ждем инициализации
            take(1),
            switchMap(authenticated => {
                if (authenticated) {
                    console.log('AuthGuard: User is authenticated');

                    // Если данные пользователя еще не загружены
                    if (!this.authService.currentUserSubject.value) {
                        console.log('AuthGuard: Loading user data');
                        return this.authService.loadCurrentUser().pipe(
                            map(() => true),
                            catchError(() => of(false))
                        );
                    }
                    return of(true);
                }

                console.log('AuthGuard: User not authenticated, redirecting to login');
                this.router.navigate(['/login'], {
                    queryParams: { next: state.url }
                });
                return of(false);
            })
        );
    }
}