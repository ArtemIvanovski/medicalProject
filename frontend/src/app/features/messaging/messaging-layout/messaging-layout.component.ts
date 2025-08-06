import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { Chat, MessagingService, MessagingUser } from "../../../core/services";
import { ContactSelectionModalComponent } from '../contact-selection-modal/contact-selection-modal.component';

@Component({
  selector: 'app-messaging-layout',
  templateUrl: './messaging-layout.component.html',
  styleUrls: ['./messaging-layout.component.scss']
})
export class MessagingLayoutComponent implements OnInit, OnDestroy {
  @ViewChild(ContactSelectionModalComponent) contactModal!: ContactSelectionModalComponent;

  chats: Chat[] = [];
  activeChat: Chat | null = null;
  isLoading = false;
  isMobile = false;
  private subscriptions = new Subscription();

  constructor(private messagingService: MessagingService) {}

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkMobile();
  }

  ngOnInit(): void {
    this.checkMobile();
    this.loadChats();

    this.subscriptions.add(
        this.messagingService.activeChat$.subscribe(chat => {
          this.activeChat = chat;
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private loadChats(): void {
    this.isLoading = true;
    this.messagingService.getChats().subscribe({
      next: (response) => {
        this.chats = response.results;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading chats:', error);
        this.isLoading = false;
      }
    });
  }

  onChatSelected(chat: Chat): void {
    this.messagingService.setActiveChat(chat);
  }

  onNewChat(): void {
    this.contactModal.show();
  }

  onContactSelected(contact: MessagingUser): void {
    this.messagingService.createOrGetChat(contact.id).subscribe({
      next: (chat) => {
        this.messagingService.setActiveChat(chat);
        this.loadChats(); // Обновляем список чатов
      },
      error: (error) => {
        console.error('Error creating chat:', error);
        if (error.error?.message) {
          this.showAlert(error.error.message, 'error');
        }
      }
    });
  }

  onBackToChats(): void {
    this.messagingService.setActiveChat(null);
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}