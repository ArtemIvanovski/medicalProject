import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "../../../environments/environment";
import {Address, Profile, ProfileData, ReferenceItem, UserInfo} from "../models/patient.models";

@Injectable({
    providedIn: 'root'
})
export class PatientService {
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

    getPatientTrustedPersons(): Observable<{trusted_persons: any[]}> {
        return this.http.get<{trusted_persons: any[]}>(`${environment.patientApiUrl}/trusted/`);
    }

    removeTrustedAccess(trustedId: string): Observable<{success: boolean}> {
        return this.http.post<{success: boolean}>(`${environment.patientApiUrl}/trusted/${trustedId}/remove/`, {});
    }

    restrictTrustedAccess(trustedId: string, features: string[]): Observable<{success: boolean}> {
        return this.http.post<{success: boolean}>(`${environment.patientApiUrl}/trusted/${trustedId}/restrict/`, {
            features
        });
    }

    inviteTrustedPerson(data: {message: string, features: string[]}): Observable<any> {
        return this.http.post(`${environment.patientApiUrl}/trusted/invite/`, data);
    }

    getTrustedPermissions(trustedId: string): Observable<any> {
        return this.http.get(`${environment.patientApiUrl}/trusted/${trustedId}/permissions/`);
    }

    updateTrustedPermissions(trustedId: string, features: string[]): Observable<{success: boolean, message: string}> {
        return this.http.put<{success: boolean, message: string}>(`${environment.patientApiUrl}/trusted/${trustedId}/permissions/update/`, {
            features
        });
    }
}