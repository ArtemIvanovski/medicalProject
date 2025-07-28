import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, map, switchMap, take } from 'rxjs';
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

        if (!this.authService.isAuthenticated()) {
            this.router.navigate(['/login'], {
                queryParams: { next: state.url }
            });
            return of(false);
        }

        // Если пользователь авторизован, но данные еще не загружены
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap((user: User | null) => {
                if (!user) {
                    // Принудительно загружаем данные пользователя
                    this.authService.loadUserData();

                    // Ждем загрузки данных
                    return this.authService.currentUser$.pipe(
                        take(1),
                        map((loadedUser: User | null) => {
                            if (!loadedUser) {
                                // Только если действительно не удалось загрузить
                                this.router.navigate(['/login'], {
                                    queryParams: { next: state.url }
                                });
                                return false;
                            }
                            return this.checkRoleAccess(loadedUser, requiredRole, state.url);
                        })
                    );
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