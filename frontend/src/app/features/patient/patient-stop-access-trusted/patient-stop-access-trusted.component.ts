import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {PatientService} from "../../../core/services";

interface TrustedPerson {
  id: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  phone_number?: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

@Component({
  selector: 'app-patient-stop-access-trusted',
  templateUrl: './patient-stop-access-trusted.component.html',
  styleUrls: ['./patient-stop-access-trusted.component.scss']
})
export class PatientStopAccessTrustedComponent implements OnInit {
  trustedPersons: TrustedPerson[] = [];
  isLoading = true;
  selectedTrustedPerson: TrustedPerson | null = null;

  constructor(
      private profileService: PatientService,
      private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTrustedPersons();
  }

  loadTrustedPersons(): void {
    this.profileService.getPatientTrustedPersons().subscribe({
      next: (response) => {
        this.trustedPersons = response.trusted_persons;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading trusted persons:', error);
        this.isLoading = false;
      }
    });
  }

  openRemoveModal(person: TrustedPerson): void {
    this.selectedTrustedPerson = person;
  }

  confirmRemoveAccess(): void {
    if (!this.selectedTrustedPerson) return;

    this.profileService.removeTrustedAccess(this.selectedTrustedPerson.id).subscribe({
      next: () => {
        this.trustedPersons = this.trustedPersons.filter(p => p.id !== this.selectedTrustedPerson!.id);
        const personName = `${this.selectedTrustedPerson!.first_name} ${this.selectedTrustedPerson!.last_name}`;
        this.selectedTrustedPerson = null;
        this.showAlert(`Доступ доверенного лица ${personName} удалён`, 'success');
      },
      error: (error) => {
        console.error('Error removing trusted access:', error);
        this.showAlert('Не удалось удалить доступ. Попробуйте ещё раз.', 'error');
      }
    });
  }

  navigateToInviteTrusted(): void {
    this.router.navigate(['/patient/invite-trusted']);
  }

  getAvatarUrl(person: TrustedPerson): string {
    if (person.avatar_url) {
      const match = person.avatar_url.match(/\/avatar\/([^\/]+)\//);
      if (match && match[1]) {
        return this.profileService.getAvatarUrl(match[1]);
      }
    }
    return 'assets/img/default-avatar.png';
  }

  getTrustedFullName(person: TrustedPerson): string {
    const parts = [person.last_name, person.first_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Нет данных';
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}