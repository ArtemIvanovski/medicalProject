import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import {environment} from "../../../environments/environment";

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

@Injectable({
    providedIn: 'root'
})
export class MessagingService {
    private activeChat = new BehaviorSubject<Chat | null>(null);
    public activeChat$ = this.activeChat.asObservable();

    constructor(private http: HttpClient) {}

    getChats(): Observable<{results: Chat[]}> {
        return this.http.get<{results: Chat[]}>(`${environment.messagingApiUrl}/chats/`);
    }

    getContacts(): Observable<{results: MessagingUser[]}> {
        return this.http.get<{results: MessagingUser[]}>(`${environment.messagingApiUrl}/contacts/`);
    }

    getChatMessages(chatId: string, page: number = 1): Observable<{results: Message[], count: number, next?: string, previous?: string}> {
        return this.http.get<{results: Message[], count: number, next?: string, previous?: string}>(`${environment.messagingApiUrl}/chats/${chatId}/messages/?page=${page}`);
    }

    sendMessage(data: {
        recipient_id: string;
        message_type?: string;
        content?: string;
        reply_to_id?: string;
    }, attachments?: File[]): Observable<Message> {
        const formData = new FormData();

        Object.keys(data).forEach(key => {
            if (data[key as keyof typeof data]) {
                formData.append(key, data[key as keyof typeof data] as string);
            }
        });

        if (attachments && attachments.length > 0) {
            attachments.forEach(file => {
                formData.append('attachments', file);
            });
        }

        return this.http.post<Message>(`${environment.messagingApiUrl}/messages/send/`, formData);
    }

    editMessage(messageId: string, content: string): Observable<Message> {
        return this.http.put<Message>(`${environment.messagingApiUrl}/messages/${messageId}/edit/`, { content });
    }

    deleteMessage(messageId: string, deleteForEveryone: boolean = false): Observable<{success: boolean}> {
        return this.http.delete<{success: boolean}>(`${environment.messagingApiUrl}/messages/${messageId}/delete/`, {
            body: { delete_for_everyone: deleteForEveryone }
        });
    }

    markAsRead(chatId: string): Observable<{success: boolean}> {
        return this.http.post<{success: boolean}>(`${environment.messagingApiUrl}/chats/${chatId}/mark-read/`, {});
    }

    searchMessages(query: string, chatId?: string): Observable<{results: Message[]}> {
        let url = `${environment.messagingApiUrl}/messages/search/?q=${encodeURIComponent(query)}`;
        if (chatId) {
            url += `&chat_id=${chatId}`;
        }
        return this.http.get<{results: Message[]}>(url);
    }

    setActiveChat(chat: Chat | null): void {
        this.activeChat.next(chat);
    }

    getActiveChat(): Chat | null {
        return this.activeChat.value;
    }

    createOrGetChat(recipientId: string): Observable<Chat> {
        return this.http.post<Chat>(`${environment.messagingApiUrl}/chats/create/`, {
            recipient_id: recipientId
        });
    }

    getAvatarUrl(avatarUrl: string | undefined): string {
        if (!avatarUrl) {
            return 'assets/img/default-avatar.png';
        }

        if (avatarUrl.startsWith('http')) {
            return avatarUrl;
        }

        // Обработка нового формата URL для аватаров
        if (avatarUrl.startsWith('/api/v1/files/')) {
            const fileId = avatarUrl.split('/')[4]; // Извлекаем ID файла из пути
            return `${environment.patientApiUrl}/avatar/${fileId}/`;
        }

        return avatarUrl;
    }
}