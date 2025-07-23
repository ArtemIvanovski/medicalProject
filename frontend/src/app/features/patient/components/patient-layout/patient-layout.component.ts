import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

declare var Swal: any;

@Component({
  selector: 'app-patient-layout',
  templateUrl: './patient-layout.component.html',
  styleUrls: ['./patient-layout.component.scss']
})
export class PatientLayoutComponent implements OnInit, OnDestroy {
  isLoading = false;
  private subscriptions = new Subscription();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initializeAlerts();
    this.handleRouteChanges();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeAlerts(): void {
    // Инициализация SweetAlert2 Toast
    if (typeof Swal !== 'undefined') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: '#f0f8ff',
        customClass: {
          popup: 'swal2-toast',
          title: 'my-swal-title',
          content: 'my-swal-content'
        },
        didOpen: (toast: any) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });

      // Переопределение window.alert для использования Toast
      (window as any).alert = function(message: string, icon: string = 'success') {
        Toast.fire({ icon, title: message });
      };
    }
  }

  private handleRouteChanges(): void {
    this.subscriptions.add(
        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
              // Скрываем preloader после загрузки страницы
              this.isLoading = false;

              // Прокручиваем страницу вверх при смене роута
              window.scrollTo(0, 0);
            })
    );
  }

  showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        icon: type,
        title: message
      });
    }
  }
}