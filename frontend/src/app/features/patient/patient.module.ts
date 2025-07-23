import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { PatientHeaderComponent } from './components/patient-header/patient-header.component';
import { PatientLayoutComponent } from './components/patient-layout/patient-layout.component';

import { RoleGuard } from '../../core/guards/role.guard';
import {SharedModule} from "../../shared/shared.module";
import {PatientMonitoringComponent} from "./patient-monitoring/patient-monitoring.component";
import {PatientDoctorComponent} from "./patient-doctor/patient-doctor.component";
import {PatientSettingsComponent} from "./patient-settings/patient-settings.component";
import {PatientTrustedPersonComponent} from "./patient-trusted-person/patient-trusted-person.component";

const routes: Routes = [
    {
        path: '',
        component: PatientLayoutComponent,
        canActivate: [RoleGuard],
        data: { role: 'PATIENT' },
        children: [
            {
                path: '',
                redirectTo: 'dashboard',
                pathMatch: 'full'
            },
            {
                path: 'dashboard',
                component: PatientDashboardComponent
            },
            {
                path: 'monitoring',
                component: PatientMonitoringComponent
            },
            {
                path: 'doctor',
                component: PatientDoctorComponent
            },
            {
                path: 'trusted-person',
                component: PatientTrustedPersonComponent
            },
            {
                path: 'settings',
                component: PatientSettingsComponent
            }
        ]
    }
];

@NgModule({
    declarations: [
        PatientDashboardComponent,
        PatientHeaderComponent,
        PatientMonitoringComponent,
        PatientDoctorComponent,
        PatientTrustedPersonComponent,
        PatientSettingsComponent,
        PatientLayoutComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class PatientModule { }