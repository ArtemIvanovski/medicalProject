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