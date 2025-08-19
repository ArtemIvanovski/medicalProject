export interface NewsletterSubscribeRequest {
    email: string;
}

export interface NewsletterResponse {
    success: boolean;
    message: string;
    email?: string;
    errors?: { [key: string]: string[] };
}

export interface NewsletterStats {
    success: boolean;
    data?: {
        active_subscribers: number;
        total_subscribers_all_time: number;
    };
}