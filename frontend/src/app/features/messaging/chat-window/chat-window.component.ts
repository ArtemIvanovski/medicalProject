import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessagingService, Chat, Message } from "../../../core/services";

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss']
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() chat: Chat | null = null;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: Message[] = [];
  newMessage = '';
  isLoading = false;
  isSending = false;
  replyToMessage: Message | null = null;
  selectedFiles: File[] = [];
  private subscriptions = new Subscription();
  private shouldScrollToBottom = false;

  constructor(public messagingService: MessagingService) {}

  ngOnInit(): void {
    if (this.chat) {
      this.loadMessages();
      this.markAsRead();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private loadMessages(): void {
    if (!this.chat) return;

    this.isLoading = true;
    this.messagingService.getChatMessages(this.chat.id).subscribe({
      next: (response) => {
        this.messages = response.results.reverse();
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.isLoading = false;
      }
    });
  }

  private markAsRead(): void {
    if (!this.chat) return;

    this.messagingService.markAsRead(this.chat.id).subscribe();
  }

  onSendMessage(): void {
    if ((!this.newMessage.trim() && this.selectedFiles.length === 0) || this.isSending || !this.chat) {
      return;
    }

    this.isSending = true;
    const messageData: any = {
      recipient_id: this.chat.companion.id,
      content: this.newMessage.trim(),
      message_type: this.selectedFiles.length > 0 ? 'file' : 'text'
    };

    if (this.replyToMessage) {
      messageData.reply_to_id = this.replyToMessage.id;
    }

    this.messagingService.sendMessage(messageData, this.selectedFiles).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.newMessage = '';
        this.selectedFiles = [];
        this.replyToMessage = null;
        this.isSending = false;
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error sending message:', error);
        this.isSending = false;
      }
    });
  }

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    this.selectedFiles = files;
  }

  onReplyToMessage(message: Message): void {
    this.replyToMessage = message;
    this.messageInput.nativeElement.focus();
  }

  onCancelReply(): void {
    this.replyToMessage = null;
  }

  onEditMessage(message: Message): void {

  }

  onDeleteMessage(message: Message): void {
    if (confirm('Удалить сообщение?')) {
      this.messagingService.deleteMessage(message.id).subscribe({
        next: () => {
          this.messages = this.messages.filter(m => m.id !== message.id);
        },
        error: (error) => {
          console.error('Error deleting message:', error);
        }
      });
    }
  }

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Could not scroll to bottom:', err);
    }
  }

  formatMessageTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }

  isMyMessage(message: Message): boolean {
    return message.sender.id !== this.chat?.companion.id;
  }

  getMessageStatus(message: Message): 'sent' | 'delivered' | 'read' {
    if (!this.isMyMessage(message)) return 'read';

    const statuses = message.statuses;
    if (statuses.some(s => s.status === 'read')) return 'read';
    if (statuses.some(s => s.status === 'delivered')) return 'delivered';
    return 'sent';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }
}