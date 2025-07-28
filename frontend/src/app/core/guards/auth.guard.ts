import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, map, take, of } from 'rxjs';
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

        if (this.authService.isAuthenticated()) {
            console.log('AuthGuard: User is authenticated');
            return of(true);
        }

        console.log('AuthGuard: User not authenticated, redirecting to login');
        this.router.navigate(['/login'], {
            queryParams: { next: state.url }
        });
        return of(false);
    }
}