import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ProfileSelectionComponent } from './features/auth/profile-selection/profile-selection.component';
import { AuthGuard } from './core/guards/auth.guard';
import {MainLayoutComponent} from "./shared/layouts/main-layout.component";

const routes: Routes = [
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            {
                path: 'login',
                component: LoginComponent
            },
            {
                path: 'register',
                component: RegisterComponent
            },
            {
                path: 'profile-selection',
                component: ProfileSelectionComponent,
                canActivate: [AuthGuard]
            }
        ]
    },
    {
        path: 'patient',
        loadChildren: () => import('./features/patient/patient.module').then(m => m.PatientModule)
    },
    {
        path: 'home',
        loadChildren: () => import('./features/home/home.module').then(m => m.HomeModule),
    },
    { path: 'unauthorized', redirectTo: '/profile-selection' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }