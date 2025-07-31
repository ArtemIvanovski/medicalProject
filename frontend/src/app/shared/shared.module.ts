import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PreloaderComponent } from './components/preloader/preloader.component';
import { MainLayoutComponent } from './layouts/main-layout.component';
import {AddIntakeModalComponent} from "./components/medication-modals/add-intake-modal/add-intake-modal.component";
import {
    CreatePatternModalComponent
} from "./components/medication-modals/create-pattern-modal/create-pattern-modal.component";
import {
    CreateReminderModalComponent
} from "./components/medication-modals/create-reminder-modal/create-reminder-modal.component";
import {EditIntakeModalComponent} from "./components/medication-modals/edit-intake-modal/edit-intake-modal.component";

@NgModule({
    declarations: [
        HeaderComponent,
        FooterComponent,
        PreloaderComponent,
        MainLayoutComponent,
        AddIntakeModalComponent,
        CreatePatternModalComponent,
        CreateReminderModalComponent,
        EditIntakeModalComponent
    ],
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        ReactiveFormsModule
    ],
    exports: [
        HeaderComponent,
        FooterComponent,
        PreloaderComponent,
        MainLayoutComponent,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        AddIntakeModalComponent,
        CreatePatternModalComponent,
        CreateReminderModalComponent,
        EditIntakeModalComponent
    ]
})
export class SharedModule { }