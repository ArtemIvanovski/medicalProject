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