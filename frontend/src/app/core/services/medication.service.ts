import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "../../../environments/environment";

export interface Drug {
    id: string;
    name: string;
    form: string;
    description: string;
}

export interface MedicationIntake {
    id: string;
    drug: string;
    drug_name: string;
    drug_form: string;
    taken_at: string;
    amount: number;
    unit: string;
    notes: string;
    created_at: string;
    updated_at: string;
}

export interface MedicationStats {
    drug_id: string;
    drug_name: string;
    drug_form: string;
    total_intakes: number;
    total_amount: number;
    avg_amount: number;
    last_taken: string;
}

export interface FavoriteDrug {
    id: string;
    drug: string;
    drug_name: string;
    drug_form: string;
    created_at: string;
}

export interface MedicationPattern {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    items: MedicationPatternItem[];
    items_count: number;
    created_at: string;
    updated_at: string;
}

export interface MedicationPatternItem {
    id: string;
    drug: string;
    drug_name: string;
    drug_form: string;
    amount: number;
    unit: string;
    notes: string;
    order: number;
}

export interface MedicationReminder {
    id: string;
    drug: string;
    drug_name: string;
    drug_form: string;
    title: string;
    amount: number;
    unit: string;
    frequency: string;
    frequency_display: string;
    time: string;
    weekdays: string[];
    start_date: string;
    end_date?: string;
    is_active: boolean;
    notes: string;
    created_at: string;
    updated_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class MedicationService {
    constructor(private http: HttpClient) {}

    searchDrugs(query: string): Observable<{query: string, results: string[]}> {
        return this.http.get<{query: string, results: string[]}>(`${environment.medicationApiUrl}/search/?query=${query}`);
    }

    getMedicationIntakes(): Observable<{results: MedicationIntake[]}> {
        return this.http.get<{results: MedicationIntake[]}>(`${environment.medicationApiUrl}/intakes/`);
    }

    createMedicationIntake(data: any): Observable<MedicationIntake> {
        return this.http.post<MedicationIntake>(`${environment.medicationApiUrl}/intakes/`, data);
    }

    updateMedicationIntake(id: string, data: any): Observable<MedicationIntake> {
        return this.http.put<MedicationIntake>(`${environment.medicationApiUrl}/intakes/${id}/`, data);
    }

    deleteMedicationIntake(id: string): Observable<void> {
        return this.http.delete<void>(`${environment.medicationApiUrl}/intakes/${id}/`);
    }

    getMedicationStats(days: number = 7): Observable<{period_days: number, stats: MedicationStats[]}> {
        return this.http.get<{period_days: number, stats: MedicationStats[]}>(`${environment.medicationApiUrl}/stats/?days=${days}`);
    }

    getMedicationTimeline(days: number = 7, drugId?: string): Observable<{days: number, drug_id?: string, intakes: MedicationIntake[]}> {
        let url = `${environment.medicationApiUrl}/timeline/?days=${days}`;
        if (drugId) {
            url += `&drug_id=${drugId}`;
        }
        return this.http.get<{days: number, drug_id?: string, intakes: MedicationIntake[]}>(url);
    }

    getFavoriteDrugs(): Observable<{results: FavoriteDrug[]}> {
        return this.http.get<{results: FavoriteDrug[]}>(`${environment.medicationApiUrl}/favorites/`);
    }

    addFavoriteDrug(drugId: string): Observable<FavoriteDrug> {
        return this.http.post<FavoriteDrug>(`${environment.medicationApiUrl}/favorites/`, { drug: drugId });
    }

    removeFavoriteDrug(drugId: string): Observable<{success: boolean}> {
        return this.http.delete<{success: boolean}>(`${environment.medicationApiUrl}/favorites/${drugId}/remove/`);
    }

    getMedicationPatterns(): Observable<{results: MedicationPattern[]}> {
        return this.http.get<{results: MedicationPattern[]}>(`${environment.medicationApiUrl}/patterns/`);
    }

    createMedicationPattern(data: any): Observable<MedicationPattern> {
        return this.http.post<MedicationPattern>(`${environment.medicationApiUrl}/patterns/`, data);
    }

    applyMedicationPattern(patternId: string, takenAt: string): Observable<{success: boolean, intakes_created: number, pattern_name: string}> {
        return this.http.post<{success: boolean, intakes_created: number, pattern_name: string}>(`${environment.medicationApiUrl}/patterns/apply/`, {
            pattern_id: patternId,
            taken_at: takenAt
        });
    }

    getMedicationReminders(): Observable<{results: MedicationReminder[]}> {
        return this.http.get<{results: MedicationReminder[]}>(`${environment.medicationApiUrl}/reminders/`);
    }

    createMedicationReminder(data: any): Observable<MedicationReminder> {
        return this.http.post<MedicationReminder>(`${environment.medicationApiUrl}/reminders/`, data);
    }

    getActiveRemindersToday(): Observable<{date: string, weekday: string, reminders: MedicationReminder[]}> {
        return this.http.get<{date: string, weekday: string, reminders: MedicationReminder[]}>(`${environment.medicationApiUrl}/reminders/today/`);
    }
}