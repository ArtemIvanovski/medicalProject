import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {ProfileService} from "../../../core/services";

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
  selector: 'app-patient-restrict-doctor-list',
  templateUrl: './patient-restrict-doctor-list.component.html',
  styleUrls: ['./patient-restrict-doctor-list.component.scss']
})
export class PatientRestrictDoctorListComponent implements OnInit {
  doctors: Doctor[] = [];
  isLoading = true;

  constructor(
      private profileService: ProfileService,
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

  navigateToRestrictAccess(doctor: Doctor): void {
    this.router.navigate(['/patient/restrict-doctor-access', doctor.id]);
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
}