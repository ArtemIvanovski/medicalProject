import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SensorService } from "../../../core/services";
import { SensorData, SensorListResponse } from "../../../core/models/sensor.models";

declare var Swal: any;

@Component({
  selector: 'app-sensor-settings',
  templateUrl: './sensor-settings.component.html',
  styleUrls: ['./sensor-settings.component.scss']
})
export class SensorSettingsComponent implements OnInit {
  sensorForm!: FormGroup;
  isLoading = false;
  isSaving = false;

  activeSensor: SensorData | null = null;
  inactiveSensors: SensorData[] = [];
  hasActiveSensor = false;

  pollingIntervalOptions = this.sensorService.getPollingIntervalOptions();

  constructor(
    private fb: FormBuilder,
    private sensorService: SensorService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Настройки датчика глюкозы');
    this.initializeForm();
    this.loadSensors();
  }

  private initializeForm(): void {
    this.sensorForm = this.fb.group({
      name: ['', Validators.required],
      low_glucose_threshold: [3.9, [Validators.required, Validators.min(0.1), Validators.max(33.3)]],
      high_glucose_threshold: [7.8, [Validators.required, Validators.min(0.1), Validators.max(33.3)]],
      polling_interval_minutes: [5, Validators.required]
    });
  }

  private loadSensors(): void {
    this.isLoading = true;
    this.sensorService.getSensors().subscribe({
      next: (response: SensorListResponse) => {
        this.hasActiveSensor = response.has_active;
        this.activeSensor = response.active_sensors.length > 0 ? response.active_sensors[0] : null;
        this.inactiveSensors = response.inactive_sensors;
        
        if (this.activeSensor) {
          this.populateForm();
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.showAlert('Ошибка загрузки данных: ' + error, 'error');
      }
    });
  }

  private populateForm(): void {
    if (this.activeSensor) {
      this.sensorForm.patchValue({
        name: this.activeSensor.name || '',
        low_glucose_threshold: this.activeSensor.low_glucose_threshold,
        high_glucose_threshold: this.activeSensor.high_glucose_threshold,
        polling_interval_minutes: this.activeSensor.polling_interval_minutes
      });
    }
  }

  onSubmit(): void {
    if (this.sensorForm.valid && this.activeSensor) {
      this.isSaving = true;
      const formValue = this.sensorForm.value;

      this.sensorService.updateSensor(this.activeSensor.id, formValue).subscribe({
        next: () => {
          this.isSaving = false;
          this.showAlert('Настройки успешно сохранены', 'success');
          this.loadSensors(); 
        },
        error: (error) => {
          this.isSaving = false;
          this.showAlert('Ошибка сохранения: ' + error, 'error');
        }
      });
    }
  }

  deactivateSensor(): void {
    if (this.activeSensor) {
      Swal.fire({
        title: 'Деактивировать датчик?',
        text: `Вы уверены, что хотите деактивировать датчик "${this.activeSensor.name || this.activeSensor.serial_number}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Да, деактивировать!',
        cancelButtonText: 'Отмена'
      }).then((result: any) => {
        if (result.isConfirmed && this.activeSensor) {
          this.sensorService.deactivateSensor(this.activeSensor.id).subscribe({
            next: () => {
              this.showAlert('Датчик деактивирован', 'success');
              this.loadSensors();
            },
            error: (error) => {
              this.showAlert('Ошибка деактивации: ' + error, 'error');
            }
          });
        }
      });
    }
  }

  orderNewSensor(): void {
    this.showAlert('Функция заказа будет доступна в ближайшее время', 'info');
  }

  getBatteryClass(level: number): string {
    if (level >= 80) return 'text-success';
    if (level >= 50) return 'text-warning';
    if (level >= 20) return 'text-orange';
    return 'text-danger';
  }

  getBatteryIcon(level: number): string {
    if (level >= 80) return 'fas fa-battery-full';
    if (level >= 60) return 'fas fa-battery-three-quarters';
    if (level >= 40) return 'fas fa-battery-half';
    if (level >= 20) return 'fas fa-battery-quarter';
    return 'fas fa-battery-empty';
  }

  getPollingIntervalLabel(minutes: number): string {
    const option = this.pollingIntervalOptions.find(opt => opt.value === minutes);
    return option ? option.label : `${minutes} мин`;
  }

  formatDateTime(dateTime: string | null | undefined): string {
    if (!dateTime) return 'Не задано';
    return new Date(dateTime).toLocaleString('ru-RU');
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return 'Не задано';
    return new Date(date).toLocaleDateString('ru-RU');
  }

  calculateWorkingTime(activation: string | null | undefined, deactivation: string | null | undefined): string {
    if (!activation || !deactivation) return 'Неизвестно';
    
    const start = new Date(activation);
    const end = new Date(deactivation);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} дн. ${diffHours} ч.`;
    } else {
      return `${diffHours} ч.`;
    }
  }

  private showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
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