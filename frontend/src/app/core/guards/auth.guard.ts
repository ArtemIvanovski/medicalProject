import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

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
        return this.authService.isAuthenticated$.pipe(
            take(1),
            map((isAuthenticated: boolean) => {
                if (isAuthenticated) {
                    return true;
                } else {
                    this.router.navigate(['/login'], {
                        queryParams: { next: state.url }
                    });
                    return false;
                }
            })
        );
    }
}