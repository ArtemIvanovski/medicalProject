import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { PatientHeaderComponent } from './components/patient-header/patient-header.component';
import { PatientLayoutComponent } from './components/patient-layout/patient-layout.component';
import { PatientMonitoringComponent } from './patient-monitoring/patient-monitoring.component';
import { PatientDoctorComponent } from './patient-doctor/patient-doctor.component';
import { PatientSettingsComponent } from './patient-settings/patient-settings.component';
import { PatientTrustedPersonComponent } from './patient-trusted-person/patient-trusted-person.component';
import { ProfileSettingsComponent } from './profile-settings/profile-settings.component';

import {PatientDoctorsListComponent} from "./patient-doctor-list/patient-doctor-list.component";
import { RoleGuard } from '../../core/guards/role.guard';
import { SharedModule } from "../../shared/shared.module";
import {PatientStopAccessDoctorComponent} from "./patient-stop-access-doctor/patient-stop-access-doctor.component";
import {AuthGuard} from "../../core/guards/auth.guard";
import {PatientInviteDoctorComponent} from "./patient-invite-doctor/patient-invite-doctor.component";
import {
    PatientRestrictDoctorAccessComponent
} from "./patient-restrict-doctor-access/patient-restrict-doctor-access.component";
import {
    PatientRestrictDoctorListComponent
} from "./patient-restrict-doctor-list/patient-restrict-doctor-list.component";
import {PatientTrustedListComponent} from "./patient-trusted-list/patient-trusted-list.component";
import {PatientStopAccessTrustedComponent} from "./patient-stop-access-trusted/patient-stop-access-trusted.component";
import {PatientInviteTrustedComponent} from "./patient-invite-trusted/patient-invite-trusted.component";
import {
    PatientRestrictTrustedAccessComponent
} from "./patient-restrict-trusted-access/patient-restrict-trusted-access.component";
import {
    PatientRestrictTrustedListComponent
} from "./patient-restrict-trusted-list/patient-restrict-trusted-list.component";

const routes: Routes = [
    {
        path: '',
        component: PatientLayoutComponent,
        canActivate: [AuthGuard, RoleGuard],
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
            },
            {
                path: 'profile-settings',
                component: ProfileSettingsComponent
            },
            {
                path: 'doctors-list',
                component: PatientDoctorsListComponent
            },
            {
                path: 'stop-access-doctor',
                component: PatientStopAccessDoctorComponent
            },
            {
                path: 'invite-doctor',
                component: PatientInviteDoctorComponent
            },
            {
                path: 'restrict-doctor-access/:doctorId',
                component: PatientRestrictDoctorAccessComponent
            },
            {
                path: 'restrict-doctor-list',
                component: PatientRestrictDoctorListComponent
            },
            {
                path: 'trusted-persons-list',
                component: PatientTrustedListComponent
            },
            {
                path: 'stop-access-trusted',
                component: PatientStopAccessTrustedComponent
            },
            {
                path: 'invite-trusted',
                component: PatientInviteTrustedComponent
            },
            {
                path: 'restrict-trusted-access/:trustedId',
                component: PatientRestrictTrustedAccessComponent
            },
            {
                path: 'restrict-trusted-list',
                component: PatientRestrictTrustedListComponent
            }
        ]
    }
];

@NgModule({
    declarations: [
        PatientDashboardComponent,
        PatientHeaderComponent,
        PatientLayoutComponent,
        PatientMonitoringComponent,
        PatientDoctorComponent,
        PatientTrustedPersonComponent,
        PatientSettingsComponent,
        PatientDoctorsListComponent,
        PatientStopAccessDoctorComponent,
        PatientInviteDoctorComponent,
        PatientRestrictDoctorAccessComponent,
        PatientRestrictDoctorListComponent,
        ProfileSettingsComponent,
        PatientRestrictTrustedListComponent,
        PatientRestrictTrustedAccessComponent,
        PatientInviteTrustedComponent,
        PatientStopAccessTrustedComponent,
        PatientTrustedListComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class PatientModule { }