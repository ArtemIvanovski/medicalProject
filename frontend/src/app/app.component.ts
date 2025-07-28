import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {AuthService} from "./core/services";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
    title = 'medical-app';

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    ngOnInit() {
        console.log('App initializing...');
        console.log('Token exists:', !!this.authService.getAccessToken());
        console.log('Is authenticated:', this.authService.isAuthenticated());

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            console.log('Navigation to:', event.url);
            console.log('Auth state:', {
                hasToken: !!this.authService.getAccessToken(),
                isAuthenticated: this.authService.isAuthenticated(),
                activeRole: this.authService.getActiveRole()
            });
        });

        this.authService.isAuthenticated$.subscribe(isAuth => {
            console.log('Auth state changed:', isAuth);
        });
    }
}