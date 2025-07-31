import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';

import { MessagingLayoutComponent } from './messaging-layout/messaging-layout.component';
import { ChatListComponent } from './chat-list/chat-list.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';

const routes: Routes = [
    {
        path: '',
        component: MessagingLayoutComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { role: 'PATIENT' }
    }
];

@NgModule({
    declarations: [
        MessagingLayoutComponent,
        ChatListComponent,
        ChatWindowComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class MessagingModule { }