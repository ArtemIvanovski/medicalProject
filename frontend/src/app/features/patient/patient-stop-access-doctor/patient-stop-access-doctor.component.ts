import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {PatientService} from "../../../core/services";

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone_number: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

@Component({
  selector: 'app-patient-stop-access-doctor',
  templateUrl: './patient-stop-access-doctor.component.html',
  styleUrls: ['./patient-stop-access-doctor.component.scss']
})
export class PatientStopAccessDoctorComponent implements OnInit {
  doctors: Doctor[] = [];
  isLoading = true;
  selectedDoctor: Doctor | null = null;

  constructor(
      private profileService: PatientService,
      private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDoctors();
  }

  loadDoctors(): void {
    this.profileService.getPatientDoctors().subscribe({
      next: (response) => {
        this.doctors = response.doctors;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        this.isLoading = false;
      }
    });
  }

  openRemoveModal(doctor: Doctor): void {
    this.selectedDoctor = doctor;
  }

  confirmRemoveAccess(): void {
    if (!this.selectedDoctor) return;

    this.profileService.removeDoctorAccess(this.selectedDoctor.id).subscribe({
      next: () => {
        this.doctors = this.doctors.filter(d => d.id !== this.selectedDoctor!.id);
        const doctorName = `${this.selectedDoctor!.first_name} ${this.selectedDoctor!.last_name}`;
        this.selectedDoctor = null;
        this.showAlert(`Доступ к врачу ${doctorName} удалён`, 'success');
      },
      error: (error) => {
        console.error('Error removing doctor access:', error);
        this.showAlert('Не удалось удалить доступ. Попробуйте ещё раз.', 'error');
      }
    });
  }

  navigateToInviteDoctor(): void {
    this.router.navigate(['/patient/invite-doctor']);
  }

  getAvatarUrl(doctor: Doctor): string {
    if (doctor.avatar_url) {
      const match = doctor.avatar_url.match(/\/avatar\/([^\/]+)\//);
      if (match && match[1]) {
        return this.profileService.getAvatarUrl(match[1]);
      }
    }
    return 'assets/img/default-avatar.png';
  }

  getDoctorFullName(doctor: Doctor): string {
    const parts = [doctor.last_name, doctor.first_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Нет данных';
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}