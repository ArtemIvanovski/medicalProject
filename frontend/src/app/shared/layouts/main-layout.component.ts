import { Component } from '@angular/core';

@Component({
    selector: 'app-main-layout',
    template: `
    <app-header></app-header>
    <app-preloader></app-preloader>
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
    <app-footer></app-footer>
  `,
    styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent { }