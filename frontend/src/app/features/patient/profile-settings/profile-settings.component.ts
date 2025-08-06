import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {Address, ProfileData, PatientService, ReferenceItem} from "../../../core/services";

declare var L: any;
declare var Swal: any;

interface GeoapifyResult {
  formatted: string;
  lat: number;
  lon: number;
  country?: string;
  city?: string;
  street?: string;
  postcode?: string;
}

@Component({
  selector: 'app-profile-settings',
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss']
})
export class ProfileSettingsComponent implements OnInit, AfterViewInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild('avatarInput', { static: false }) avatarInput!: ElementRef;

  profileForm!: FormGroup;
  isLoading = false;

  genders: ReferenceItem[] = [];
  bloodTypes: ReferenceItem[] = [];
  allergies: ReferenceItem[] = [];
  diagnoses: ReferenceItem[] = [];
  diabetesTypes: ReferenceItem[] = [];

  selectedAllergies: ReferenceItem[] = [];
  selectedDiagnoses: ReferenceItem[] = [];

  suggestions: GeoapifyResult[] = [];
  showSuggestions = false;

  map: any;
  marker: any;
  avatarUrl: string | null = null;

  private readonly geoapifyApiKey = 'f11fa4e8d8634135931eb6d9327330d0';

  constructor(
      private fb: FormBuilder,
      private profileService: PatientService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadReferenceData();
    this.loadProfile();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  private initializeForm(): void {
    this.profileForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      patronymic: [''],
      birth_date: [''],
      phone_number: [''],
      gender: [''],
      blood_type: [''],
      diabetes_type: [''],
      height: [''],
      weight: [''],
      waist_circumference: [''],
      address_input: [''],
      country: [''],
      city: [''],
      street: [''],
      postcode: [''],
      latitude: [''],
      longitude: [''],
      formatted: ['']
    });
  }

  private loadReferenceData(): void {
    this.profileService.getGenders().subscribe(data => this.genders = data);
    this.profileService.getBloodTypes().subscribe(data => this.bloodTypes = data);
    this.profileService.getAllergies().subscribe(data => this.allergies = data);
    this.profileService.getDiagnoses().subscribe(data => this.diagnoses = data);
    this.profileService.getDiabetesTypes().subscribe(data => this.diabetesTypes = data);
  }

  // Замените весь метод loadProfile():
  private loadProfile(): void {
    this.profileService.getProfile().subscribe({
      next: (data: ProfileData) => {
        this.profileForm.patchValue({
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          patronymic: data.user.patronymic,
          birth_date: data.user.birth_date,
          phone_number: data.user.phone_number,
          gender: data.profile.gender,
          blood_type: data.profile.blood_type,
          diabetes_type: data.profile.diabetes_type,
          height: data.profile.height,
          weight: data.profile.weight,
          waist_circumference: data.profile.waist_circumference
        });

        if (data.profile.address_home) {
          this.setAddress(data.profile.address_home);
        }

        if (data.user.avatar_drive_id) {
          this.avatarUrl = this.profileService.getAvatarUrl(data.user.avatar_drive_id);
        }

        // Отложенная загрузка аллергий и диагнозов
        setTimeout(() => {
          this.selectedAllergies = data.profile.allergies
              .map(allergyName => this.allergies.find(a => a.name === allergyName))
              .filter((allergy): allergy is ReferenceItem => allergy !== undefined);

          this.selectedDiagnoses = data.profile.diagnoses
              .map(diagnosisName => this.diagnoses.find(d => d.name === diagnosisName))
              .filter((diagnosis): diagnosis is ReferenceItem => diagnosis !== undefined);
        }, 100);
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.showAlert('Ошибка загрузки профиля', 'error');
      }
    });
  }

  private initializeMap(): void {
    if (this.mapContainer) {
      this.map = L.map(this.mapContainer.nativeElement).setView([53.9, 27.5667], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '©OpenStreetMap'
      }).addTo(this.map);

      // Добавляем обработчик клика по карте
      this.map.on('click', (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        this.reverseGeocode(lat, lng);
      });

      const lat = this.profileForm.get('latitude')?.value;
      const lon = this.profileForm.get('longitude')?.value;
      if (lat && lon) {
        this.updateMapPosition(lat, lon);
      }
    }
  }

// Добавьте новый метод для обратного геокодирования
  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${this.geoapifyApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        this.setAddress({
          formatted: result.formatted,
          latitude: lat,
          longitude: lng,
          country: result.country || '',
          city: result.city || '',
          street: result.street || '',
          postcode: result.postcode || ''
        });
        this.updateMapPosition(lat, lng);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  }

  onAddressInput(event: any): void {
    const query = event.target.value;
    if (query.length >= 3) {
      this.debounce(() => this.fetchSuggestions(query), 300);
    } else {
      this.showSuggestions = false;
    }
  }

  private async fetchSuggestions(query: string): Promise<void> {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encoded}&limit=5&format=json&apiKey=${this.geoapifyApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        this.suggestions = data.results;
        this.showSuggestions = true;
      } else {
        this.showSuggestions = false;
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.showSuggestions = false;
    }
  }

  selectAddress(result: GeoapifyResult): void {
    this.setAddress({
      formatted: result.formatted,
      latitude: result.lat,
      longitude: result.lon,
      country: result.country || '',
      city: result.city || '',
      street: result.street || '',
      postcode: result.postcode || ''
    });
    this.showSuggestions = false;
    this.updateMapPosition(result.lat, result.lon);
  }

  private setAddress(address: Address): void {
    this.profileForm.patchValue({
      address_input: address.formatted,
      country: address.country,
      city: address.city,
      street: address.street,
      postcode: address.postcode,
      latitude: address.latitude,
      longitude: address.longitude,
      formatted: address.formatted
    });
  }

  private updateMapPosition(lat: number, lon: number): void {
    if (this.map) {
      this.map.setView([lat, lon], 16);
      if (this.marker) {
        this.map.removeLayer(this.marker);
      }
      this.marker = L.marker([lat, lon]).addTo(this.map);
    }
  }

  // Замените метод addAllergy:
  addAllergy(allergyId: string): void {
    if (!allergyId) return;
    const allergy = this.allergies.find(a => a.id == allergyId); // == вместо ===
    if (allergy && !this.selectedAllergies.find(a => a.id == allergyId)) {
      this.selectedAllergies.push(allergy);
    }
  }

// Замените метод addDiagnosis:
  addDiagnosis(diagnosisId: string): void {
    if (!diagnosisId) return;
    const diagnosis = this.diagnoses.find(d => d.id == diagnosisId); // == вместо ===
    if (diagnosis && !this.selectedDiagnoses.find(d => d.id == diagnosisId)) {
      this.selectedDiagnoses.push(diagnosis);
    }
  }

// Замените метод removeAllergy:
  removeAllergy(allergyId: string): void {
    this.selectedAllergies = this.selectedAllergies.filter(a => a.id != allergyId); // != вместо !==
  }

// Замените метод removeDiagnosis:
  removeDiagnosis(diagnosisId: string): void {
    this.selectedDiagnoses = this.selectedDiagnoses.filter(d => d.id != diagnosisId); // != вместо !==
  }

  onAvatarChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadAvatar(file);
    }
  }

  private uploadAvatar(file: File): void {
    this.isLoading = true;
    this.profileService.uploadAvatar(file).subscribe({
      next: (response) => {
        this.avatarUrl = this.profileService.getAvatarUrl(response.file_id);
        this.isLoading = false;
        this.showAlert('Аватар успешно загружен', 'success');
      },
      error: (error) => {
        this.isLoading = false;
        this.showAlert('Ошибка загрузки аватара', 'error');
      }
    });
  }

  deleteAvatar(): void {
    this.profileService.deleteAvatar().subscribe({
      next: () => {
        this.avatarUrl = null;
        this.showAlert('Аватар удален', 'success');
      },
      error: (error) => {
        this.showAlert('Ошибка удаления аватара', 'error');
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isLoading = true;

      const formValue = this.profileForm.value;

      const userInfo = {
        first_name: formValue.first_name,
        last_name: formValue.last_name,
        patronymic: formValue.patronymic,
        birth_date: formValue.birth_date,
        phone_number: formValue.phone_number
      };

      const profileDetails = {
        gender: formValue.gender,
        blood_type: formValue.blood_type,
        diabetes_type: formValue.diabetes_type,
        height: formValue.height,
        weight: formValue.weight,
        waist_circumference: formValue.waist_circumference,
        allergies: this.selectedAllergies.map(a => a.name),
        diagnoses: this.selectedDiagnoses.map(d => d.name)
      };

      const updatePromises = [
        this.profileService.updateUserInfo(userInfo),
        this.profileService.updateProfileDetails(profileDetails)
      ];

      if (formValue.latitude && formValue.longitude) {
        const addressData: Address = {
          city: formValue.city,
          country: formValue.country,
          formatted: formValue.formatted,
          latitude: formValue.latitude,
          longitude: formValue.longitude,
          postcode: formValue.postcode,
          street: formValue.street
        };
        updatePromises.push(this.profileService.updateAddress(addressData));
      }

      const promises = updatePromises.map(p => p.toPromise());

      Promise.all(promises).then(() => {
        this.isLoading = false;
        this.showAlert('Профиль успешно сохранен', 'success');
      }).catch((error) => {
        this.isLoading = false;
        console.error('Error:', error);
        this.showAlert('Ошибка сохранения профиля', 'error');
      });
    }
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions = false, 200);
  }

  private debounce(func: Function, wait: number): void {
    let timeout: any;
    clearTimeout(timeout);
    timeout = setTimeout(() => func(), wait);
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