import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface MonitoringCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-patient-monitoring',
  templateUrl: './patient-monitoring.component.html',
  styleUrls: ['./patient-monitoring.component.scss']
})
export class PatientMonitoringComponent {

  monitoringCards: MonitoringCard[] = [
    {
      id: 'physical-activity',
      title: 'Физическая активность',
      description: 'Отслеживайте свои тренировки, шаги и спортивные достижения для поддержания здоровья и физической формы.',
      icon: 'fas fa-running',
      route: '/patient/monitoring/activity'
    },
    {
      id: 'nutrition',
      title: 'Питание',
      description: 'Следите за рационом, калорийностью и качеством пищи, чтобы достигать своих целей в питании.',
      icon: 'fas fa-utensils',
      route: '/patient/monitoring/nutrition'
    },
    {
      id: 'medication',
      title: 'Лекарственная терапия',
      description: 'Контролируйте прием лекарств, дозировку и время приема для оптимального лечения и самочувствия.',
      icon: 'fas fa-medkit',
      route: '/patient/monitoring/medication'
    }
  ];

  constructor(private router: Router) {}

  navigateToCard(route: string): void {
    this.router.navigate([route]);
  }
}