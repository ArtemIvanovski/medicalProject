import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

// Импортируйте ваши shared компоненты с правильными именами
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PreloaderComponent } from './components/preloader/preloader.component';
import { MainLayoutComponent } from './layouts/main-layout.component';

@NgModule({
    declarations: [
        HeaderComponent,
        FooterComponent,
        PreloaderComponent,
        MainLayoutComponent
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
        // Экспортируем модули для использования в других модулях
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule
    ]
})
export class SharedModule { }