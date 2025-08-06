export interface RoleData {
    name: string;
    display_name: string;
    icon: string;
    notifications: number;
    messages: number;
}

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    phone_number: string;
    roles: string[];
    role_data?: RoleData[];
    active_role?: string;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    user: User;
    role_data: RoleData[];
    needs_role_selection: boolean;
    message: string;
}

export interface RegisterRequest {
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    password: string;
    invitation_token: string;
}

export interface InvitationValidation {
    valid: boolean;
    invitation_type?: string;
    expires_at?: string;
    target_role?: string;
    error?: string;
}
