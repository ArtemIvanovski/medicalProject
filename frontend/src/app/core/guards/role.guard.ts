import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService, User } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class RoleGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ): Observable<boolean> {
        const requiredRole = route.data['role'] as string;

        return this.authService.currentUser$.pipe(
            map((user: User | null) => {
                if (!user) {
                    this.router.navigate(['/login'], {
                        queryParams: { next: state.url }
                    });
                    return false;
                }

                if (!user.roles.includes(requiredRole)) {
                    this.router.navigate(['/unauthorized']);
                    return false;
                }

                const activeRole = this.authService.getActiveRole();

                if (activeRole !== requiredRole) {
                    if (user.roles.length > 1) {
                        this.router.navigate(['/profile-selection'], {
                            queryParams: {
                                next: state.url,
                                role_needed: requiredRole
                            }
                        });
                        return false;
                    } else {
                        this.authService.setActiveRole(requiredRole).subscribe();
                    }
                }

                return true;
            })
        );
    }
}