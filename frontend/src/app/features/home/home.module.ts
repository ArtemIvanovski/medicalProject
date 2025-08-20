import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {HomeComponent} from "./home/home.component";
import {SharedModule} from "../../shared/shared.module";
import {ContactUsComponent} from "./contact-us/contact-us.component";
import {BlogsGridComponent} from "./blogs-grid/blogs-grid.component";
import {BlogsGridExampleComponent} from "./blogs-grid-example/blogs-grid-example.component";
import {BlogSingleComponent} from "./blog-single/blog-single.component";

const routes: Routes = [
    {
        path: '',
        children: [
            {
                path: '',
                redirectTo: 'home',
                pathMatch: 'full'
            },
            {
                path: 'home',
                component: HomeComponent
            },
            {
                path: 'contact_us',
                component: ContactUsComponent
            },
            {
                path: 'blogs-grid',
                component: BlogsGridComponent
            },
            {
                path: 'blogs-grid-example',
                component: BlogsGridExampleComponent
            },
            {
                path: 'blog-single/:id',
                component: BlogSingleComponent
            }
        ]
    }
];

@NgModule({
    declarations: [
        HomeComponent,
        ContactUsComponent,
        BlogsGridComponent,
        BlogsGridExampleComponent,
        BlogSingleComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class HomeModule { }