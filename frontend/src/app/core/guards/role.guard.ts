// role.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, map, switchMap, take, filter } from 'rxjs';
import {AuthService} from "../services";
import {User} from "../models";

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
            filter(user => user !== null),
            take(1),
            switchMap((user: User | null) => {
                if (!user) {
                    this.router.navigate(['/login'], {
                        queryParams: { next: state.url }
                    });
                    return of(false);
                }

                return of(this.checkRoleAccess(user, requiredRole, state.url));
            })
        );
    }

    private checkRoleAccess(user: User, requiredRole: string, nextUrl: string): boolean {
        if (!user.roles.includes(requiredRole)) {
            this.router.navigate(['/unauthorized']);
            return false;
        }

        const activeRole = this.authService.getActiveRole();

        if (activeRole !== requiredRole) {
            if (user.roles.length > 1) {
                this.router.navigate(['/profile-selection'], {
                    queryParams: {
                        next: nextUrl,
                        role_needed: requiredRole
                    }
                });
                return false;
            } else {
                this.authService.setActiveRole(requiredRole).subscribe();
            }
        }

        return true;
    }
}