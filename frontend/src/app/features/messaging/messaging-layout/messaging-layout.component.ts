import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {Chat, MessagingService} from "../../../core/services";

@Component({
  selector: 'app-messaging-layout',
  templateUrl: './messaging-layout.component.html',
  styleUrls: ['./messaging-layout.component.scss']
})
export class MessagingLayoutComponent implements OnInit, OnDestroy {
  chats: Chat[] = [];
  activeChat: Chat | null = null;
  isLoading = false;
  private subscriptions = new Subscription();

  constructor(private messagingService: MessagingService) {}

  ngOnInit(): void {
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

  }
}