import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {MedicationOverviewComponent} from "./medication-overview/medication-overview.component";
import {RoleGuard} from "../../core/guards/role.guard";
import {AuthGuard} from "../../core/guards/auth.guard";
import {SharedModule} from "../../shared/shared.module";
import {MedicationHistoryComponent} from "./medication-history/medication-history.component";
import {MedicationStatsComponent} from "./medication-stats/medication-stats.component";
import {MedicationFavoritesComponent} from "./medication-favorites/medication-favorites.component";
import {MedicationPatternsComponent} from "./medication-patterns/medication-patterns.component";


const routes: Routes = [
    {
        path: '',
        redirectTo: 'medication',
        pathMatch: 'full'
    },
    {
        path: 'medication',
        component: MedicationOverviewComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    },
    {
        path: 'medication/history',
        component: MedicationHistoryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    },
    {
        path: 'medication/stats',
        component: MedicationStatsComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    },
    {
        path: 'medication/favorites',
        component: MedicationFavoritesComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    },
    {
        path: 'medication/patterns',
        component: MedicationPatternsComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    }
];

@NgModule({
    declarations: [
        MedicationHistoryComponent,
        MedicationStatsComponent,
        MedicationPatternsComponent,
        MedicationFavoritesComponent,
        MedicationOverviewComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class MonitoringModule { }