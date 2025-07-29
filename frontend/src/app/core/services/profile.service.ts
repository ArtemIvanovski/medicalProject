import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "../../../environments/environment";

export interface UserInfo {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    patronymic?: string;
    birth_date?: string;
    phone_number?: string;
    avatar_drive_id?: string;
}

export interface Address {
    city: string;
    country: string;
    formatted: string;
    latitude: number;
    longitude: number;
    postcode?: string;
    street?: string;
}

export interface Profile {
    gender?: string;
    blood_type?: string;
    height?: number;
    weight?: number;
    waist_circumference?: number;
    diabetes_type?: string;
    allergies: string[];
    diagnoses: string[];
    address_home?: Address;
}

export interface ProfileData {
    user: UserInfo;
    profile: Profile;
}

export interface ReferenceItem {
    id: string;
    name: string;
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    constructor(private http: HttpClient) {}

    getProfile(): Observable<ProfileData> {
        return this.http.get<ProfileData>(`${environment.patientApiUrl}/profile/`);
    }

    updateUserInfo(data: Partial<UserInfo>): Observable<{success: boolean}> {
        return this.http.put<{success: boolean}>(`${environment.patientApiUrl}/profile/user/`, data);
    }

    updateProfileDetails(data: Partial<Profile>): Observable<{success: boolean}> {
        return this.http.put<{success: boolean}>(`${environment.patientApiUrl}/profile/details/`, data);
    }

    updateAddress(data: Address): Observable<{success: boolean}> {
        return this.http.put<{success: boolean}>(`${environment.patientApiUrl}/profile/address/`, data);
    }

    uploadAvatar(file: File): Observable<{success: boolean, file_id: string}> {
        const formData = new FormData();
        formData.append('avatar', file);
        return this.http.post<{success: boolean, file_id: string}>(`${environment.patientApiUrl}/profile/avatar/`, formData);
    }

    deleteAvatar(): Observable<{success: boolean}> {
        return this.http.delete<{success: boolean}>(`${environment.patientApiUrl}/profile/avatar/delete/`);
    }

    getGenders(): Observable<ReferenceItem[]> {
        return this.http.get<ReferenceItem[]>(`${environment.patientApiUrl}/references/genders/`);
    }

    getBloodTypes(): Observable<ReferenceItem[]> {
        return this.http.get<ReferenceItem[]>(`${environment.patientApiUrl}/references/blood-types/`);
    }

    getAllergies(): Observable<ReferenceItem[]> {
        return this.http.get<ReferenceItem[]>(`${environment.patientApiUrl}/references/allergies/`);
    }

    getDiagnoses(): Observable<ReferenceItem[]> {
        return this.http.get<ReferenceItem[]>(`${environment.patientApiUrl}/references/diagnoses/`);
    }

    getDiabetesTypes(): Observable<ReferenceItem[]> {
        return this.http.get<ReferenceItem[]>(`${environment.patientApiUrl}/references/diabetes-types/`);
    }

    getAvatarUrl(fileId: string): string {
        return `${environment.patientApiUrl}/avatar/${fileId}/`;
    }

    getPatientDoctors(): Observable<{doctors: any[]}> {
        return this.http.get<{doctors: any[]}>(`${environment.patientApiUrl}/doctors/`);
    }

    removeDoctorAccess(doctorId: string): Observable<{success: boolean}> {
        return this.http.post<{success: boolean}>(`${environment.patientApiUrl}/doctors/${doctorId}/remove/`, {});
    }

    restrictDoctorAccess(doctorId: string, features: string[]): Observable<{success: boolean}> {
        return this.http.post<{success: boolean}>(`${environment.patientApiUrl}/doctors/${doctorId}/restrict/`, {
            features
        });
    }

    inviteDoctor(data: {message: string, features: string[]}): Observable<any> {
        return this.http.post(`${environment.patientApiUrl}/doctors/invite/`, data);
    }

    getAvailableFeatures(): Observable<{features: any[]}> {
        return this.http.get<{features: any[]}>(`${environment.patientApiUrl}/features/`);
    }

    getDoctorPermissions(doctorId: string): Observable<any> {
        return this.http.get(`${environment.patientApiUrl}/doctors/${doctorId}/permissions/`);
    }

    updateDoctorPermissions(doctorId: string, features: string[]): Observable<{success: boolean, message: string}> {
        return this.http.put<{success: boolean, message: string}>(`${environment.patientApiUrl}/doctors/${doctorId}/permissions/update/`, {
            features
        });
    }
}