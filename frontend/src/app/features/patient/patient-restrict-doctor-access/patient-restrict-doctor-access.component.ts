import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {ProfileService} from "../../../core/services";

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  email: string;
}

interface FeaturePermission {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
}

@Component({
  selector: 'app-patient-restrict-doctor-access',
  templateUrl: './patient-restrict-doctor-access.component.html',
  styleUrls: ['./patient-restrict-doctor-access.component.scss']
})
export class PatientRestrictDoctorAccessComponent implements OnInit {
  restrictForm!: FormGroup;
  isLoading = true;
  isSaving = false;
  doctor: Doctor | null = null;
  features: FeaturePermission[] = [];
  doctorId: string = '';
  openAccordions: Set<string> = new Set();

  constructor(
      private fb: FormBuilder,
      private route: ActivatedRoute,
      private router: Router,
      private profileService: ProfileService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.doctorId = params['doctorId'];
      this.initializeForm();
      this.loadDoctorPermissions();
    });
  }

  initializeForm(): void {
    this.restrictForm = this.fb.group({
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
      view_alerts: [false]
    });
  }

  loadDoctorPermissions(): void {
    this.profileService.getDoctorPermissions(this.doctorId).subscribe({
      next: (response) => {
        this.doctor = response.doctor;
        this.features = response.features;
        this.setFormValues(response.current_permissions);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading doctor permissions:', error);
        this.showAlert('Ошибка при загрузке данных', 'error');
        this.isLoading = false;
      }
    });
  }

  setFormValues(currentPermissions: string[]): void {
    const formControls: any = {};

    currentPermissions.forEach(permission => {
      const formFieldName = permission.toLowerCase();
      formControls[formFieldName] = true;
    });

    this.restrictForm.patchValue(formControls);
  }
  onSubmit(): void {
    if (this.restrictForm.valid) {
      this.isSaving = true;

      const selectedFeatures = this.getSelectedFeatures();

      this.profileService.updateDoctorPermissions(this.doctorId, selectedFeatures).subscribe({
        next: (response) => {
          this.isSaving = false;
          this.showAlert(response.message || 'Права доступа успешно обновлены', 'success');
          setTimeout(() => {
            this.router.navigate(['/patient/doctors-list']);
          }, 1500);
        },
        error: (error) => {
          this.isSaving = false;
          console.error('Error updating permissions:', error);
          this.showAlert('Ошибка при обновлении прав доступа', 'error');
        }
      });
    }
  }

  getSelectedFeatures(): string[] {
    const features: string[] = [];
    const formValue = this.restrictForm.value;

    Object.keys(formValue).forEach(key => {
      if (formValue[key]) {
        features.push(key.toUpperCase());
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

  getDoctorFullName(): string {
    if (!this.doctor) return '';
    const parts = [this.doctor.last_name, this.doctor.first_name, this.doctor.patronymic]
        .filter(Boolean);
    return parts.join(' ');
  }

  goBack(): void {
    this.router.navigate(['/patient/doctors-list']);
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}