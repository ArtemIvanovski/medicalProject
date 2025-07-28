import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {HomeComponent} from "./home/home.component";
import {SharedModule} from "../../shared/shared.module";
import {ContactUsComponent} from "./contact-us/contact-us.component";

const routes: Routes = [
    {
        path: '',
        children: [
            {
                path: '',
                redirectTo: 'dashboard',
                pathMatch: 'full'
            },
            {
                path: 'home',
                component: HomeComponent
            },
            {
                path: 'contact_us',
                component: HomeComponent
            }
        ]
    }
];

@NgModule({
    declarations: [
        HomeComponent,
        ContactUsComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class HomeModule { }