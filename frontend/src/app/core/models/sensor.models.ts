export interface SensorData {
    id: string;
    serial_number: string;
    name: string;
    active: boolean;
    created_at: string;
    last_request?: string | null | undefined;
    time_active?: string | null | undefined;
    time_deactive?: string | null | undefined;
    // Данные настроек включены в основной объект
    battery_level: number;
    low_glucose_threshold: number;
    high_glucose_threshold: number;
    polling_interval_minutes: number;
    activation_time?: string | null | undefined;
    expiration_time?: string | null | undefined;
}

export interface SensorListResponse {
    active_sensors: SensorData[];
    inactive_sensors: SensorData[];
    has_active: boolean;
}

export interface SensorSettings {
    battery_level: number;
    low_glucose_threshold: number;
    high_glucose_threshold: number;
    polling_interval_minutes: number;
    activation_time: string | null;
    expiration_time: string | null;
}

export interface SensorStatus {
    sensor_id: string;
    serial_number: string;
    sync_status: string;
    last_request: string | null;
    nonce_window: {
        start: number;
        size: number;
        current_end: number;
    };
    pending_batches: number;
    active_nonces: number;
    device_clock_offset: number;
    last_sync: number;
}

export interface SensorCreateRequest {
    serial_number: string;
    name?: string;
}

export interface SensorUpdateRequest {
    name?: string;
    active?: boolean;
}

export interface SensorSettingsUpdateRequest {
    battery_level?: number;
    low_glucose_threshold?: number;
    high_glucose_threshold?: number;
    polling_interval_minutes?: number;
    activation_time?: string;
    expiration_time?: string;
}