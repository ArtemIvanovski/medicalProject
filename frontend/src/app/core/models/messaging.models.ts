export interface MessagingUser {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar_url?: string;
    last_seen?: string;
    can_send_message: {
        allowed: boolean;
        message?: string;
    };
}

export interface MessageAttachment {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_url: string;
    thumbnail_url?: string;
}

export interface MessageStatus {
    user: MessagingUser;
    status: 'sent' | 'delivered' | 'read';
    timestamp: string;
}

export interface Message {
    id: string;
    sender: MessagingUser;
    message_type: 'text' | 'image' | 'video' | 'file' | 'voice';
    content: string;
    sent_at: string;
    edited_at?: string;
    is_edited: boolean;
    reply_to?: {
        id: string;
        sender: MessagingUser;
        content: string;
        message_type: string;
    };
    attachments: MessageAttachment[];
    statuses: MessageStatus[];
    can_edit: boolean;
    can_delete_for_everyone: boolean;
}

export interface Chat {
    id: string;
    participants: MessagingUser[];
    last_message?: Message;
    unread_count: number;
    companion: MessagingUser;
    updated_at: string;
}