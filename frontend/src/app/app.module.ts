import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';

import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ProfileSelectionComponent } from './features/auth/profile-selection/profile-selection.component';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { DebugAuthComponent } from './debug-auth.component';

export function initializeApp(authService: AuthService) {
    return () => {
        return new Promise<void>((resolve) => {
            console.log('APP_INITIALIZER: Checking authentication state');

            if (authService.isAuthenticated()) {
                console.log('APP_INITIALIZER: User is authenticated, initializing state');
                authService.initializeAuthenticatedState();
                // Загружаем данные пользователя после инициализации
                authService.loadUserData();
            } else {
                console.log('APP_INITIALIZER: User is not authenticated');
            }

            resolve();
        });
    };
}

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent,
        RegisterComponent,
        DebugAuthComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        ReactiveFormsModule,
        HttpClientModule,
        RouterModule,
        SharedModule,
        ProfileSelectionComponent,
        AppRoutingModule
    ],
    providers: [
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi: true
        },
        {
            provide: APP_INITIALIZER,
            useFactory: initializeApp,
            deps: [AuthService],
            multi: true
        }
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }