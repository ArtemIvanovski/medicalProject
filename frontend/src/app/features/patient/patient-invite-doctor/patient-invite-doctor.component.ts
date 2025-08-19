import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup } from '@angular/forms';
import {PatientService} from "../../../core/services";
import * as QRCode from 'qrcode';

interface Feature {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface InviteResponse {
  success: boolean;
  token: string;
  invite_link: string;
  expires_at: string;
  qr_base64?: string;
}

@Component({
  selector: 'app-patient-invite-doctor',
  templateUrl: './patient-invite-doctor.component.html',
  styleUrls: ['./patient-invite-doctor.component.scss']
})
export class PatientInviteDoctorComponent implements OnInit {
  inviteForm!: FormGroup;
  isLoading = false;
  features: Feature[] = [];
  inviteLink = '';
  qrBase64 = '';
  showModal = false;
  openAccordions: Set<string> = new Set();

  constructor(
      private fb: FormBuilder,
      private profileService: PatientService,
      private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Приглашение врача');
    this.initializeForm();
    this.loadFeatures();
  }

  initializeForm(): void {
    this.inviteForm = this.fb.group({
      view_sensor: [false],
      manage_sensor: [false],
      agp_daily: [false],
      agp_all_time: [false],
      view_glucose: [false],
      daily_profiles: [false],
      monitor_nutrition: [false],
      monitor_activity: [false],
      monitor_medication: [false],
      send_message: [false],
      view_alerts: [false],
      message: ['Приглашаю вас стать моим лечащим врачом в медицинской платформе мониторинга глюкозы.']
    });
  }

  loadFeatures(): void {
    this.profileService.getAvailableFeatures().subscribe({
      next: (response) => {
        this.features = response.features;
      },
      error: (error) => {
        console.error('Error loading features:', error);
      }
    });
  }

  onSubmit(): void {
    if (this.inviteForm.valid) {
      this.isLoading = true;

      const selectedFeatures = this.getSelectedFeatures();
      const requestData = {
        message: this.inviteForm.get('message')?.value || '',
        features: selectedFeatures
      };

      this.profileService.inviteDoctor(requestData).subscribe({
        next: (response: InviteResponse) => {
          this.isLoading = false;
          this.inviteLink = response.invite_link;
          this.generateQRCode(response.invite_link);
          this.showModal = true;
          setTimeout(() => this.openShareModal(), 100);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error creating invite:', error);
          this.showAlert('Ошибка при создании приглашения', 'error');
        }
      });
    }
  }

  generateQRCode(text: string): void {
    QRCode.toDataURL(text, { width: 180 })
        .then((dataUrl: string) => {
          this.qrBase64 = dataUrl.split(',')[1];
        })
        .catch(err => {
          console.error('QR Code generation failed:', err);
        });
  }

  getSelectedFeatures(): string[] {
    const features: string[] = [];
    const formValue = this.inviteForm.value;

    Object.keys(formValue).forEach(key => {
      if (key !== 'message' && formValue[key]) {
        features.push(key);
      }
    });

    return features;
  }

  toggleAccordion(sectionId: string): void {
    if (this.openAccordions.has(sectionId)) {
      this.openAccordions.delete(sectionId);
    } else {
      this.openAccordions.clear();
      this.openAccordions.add(sectionId);
    }
  }

  isAccordionOpen(sectionId: string): boolean {
    return this.openAccordions.has(sectionId);
  }

  openShareModal(): void {
    const modalElement = document.getElementById('shareModal');
    if (modalElement && typeof (window as any).bootstrap !== 'undefined') {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  shareTelegram(): void {
    const message = this.inviteForm.get('message')?.value || '';
    const text = encodeURIComponent(message + "\n\nПереходи по ссылке:\n" + this.inviteLink);
    const url = `https://t.me/share/url?url=${encodeURIComponent(this.inviteLink)}&text=${text}`;
    window.open(url, '_blank');
  }

  shareVK(): void {
    const url = `https://vk.com/share.php?url=${encodeURIComponent(this.inviteLink)}`;
    window.open(url, '_blank');
  }

  shareEmail(): void {
    const message = this.inviteForm.get('message')?.value || '';
    const subject = encodeURIComponent('Приглашение присоединиться');
    const body = encodeURIComponent(message + "\n\n" + this.inviteLink);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.inviteLink)
        .then(() => this.showAlert('Ссылка скопирована!', 'success'))
        .catch(() => this.showAlert('Не удалось скопировать', 'error'));
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}