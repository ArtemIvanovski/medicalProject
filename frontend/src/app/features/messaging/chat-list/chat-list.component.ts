import { Component, Input, Output, EventEmitter } from '@angular/core';
import {Chat} from "../../../core/services";

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss']
})
export class ChatListComponent {
  @Input() chats: Chat[] = [];
  @Input() activeChat: Chat | null = null;
  @Input() isLoading = false;
  @Output() chatSelected = new EventEmitter<Chat>();
  @Output() newChat = new EventEmitter<void>();

  searchQuery = '';

  get filteredChats(): Chat[] {
    if (!this.searchQuery.trim()) {
      return this.chats;
    }

    return this.chats.filter(chat =>
        chat.companion.full_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (chat.last_message?.content?.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );
  }

  onChatClick(chat: Chat): void {
    this.chatSelected.emit(chat);
  }

  onNewChatClick(): void {
    this.newChat.emit();
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 24 * 7) {
      return date.toLocaleDateString('ru', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' });
    }
  }

  getLastMessagePreview(chat: Chat): string {
    if (!chat.last_message) return 'Нет сообщений';

    const message = chat.last_message;
    if (message.message_type === 'text') {
      return message.content;
    } else if (message.message_type === 'image') {
      return '📷 Фото';
    } else if (message.message_type === 'file') {
      return '📎 Файл';
    } else if (message.message_type === 'voice') {
      return '🎤 Голосовое сообщение';
    }
    return 'Сообщение';
  }
}