import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MessagingService } from '../../../core/services';
import {MessagingUser} from "../../../core/models";

declare var bootstrap: any;

@Component({
  selector: 'app-contact-selection-modal',
  templateUrl: './contact-selection-modal.component.html',
  styleUrls: ['./contact-selection-modal.component.scss']
})
export class ContactSelectionModalComponent implements OnInit {
  @Output() contactSelected = new EventEmitter<MessagingUser>();

  contacts: MessagingUser[] = [];
  searchQuery = '';
  isLoading = false;
  private modal: any;

  constructor(public messagingService: MessagingService) {}

  ngOnInit(): void {
    this.loadContacts();
  }

  get filteredContacts(): MessagingUser[] {
    if (!this.searchQuery.trim()) {
      return this.contacts;
    }
    return this.contacts.filter(contact =>
        contact.full_name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  show(): void {
    if (!this.modal) {
      const modalElement = document.getElementById('contactSelectionModal');
      this.modal = new bootstrap.Modal(modalElement);
    }
    this.modal.show();
  }

  hide(): void {
    if (this.modal) {
      this.modal.hide();
    }
  }

  private loadContacts(): void {
    this.isLoading = true;
    this.messagingService.getContacts().subscribe({
      next: (response) => {
        this.contacts = response.results;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading contacts:', error);
        this.isLoading = false;
      }
    });
  }

  onContactSelected(contact: MessagingUser): void {
    if (!contact.can_send_message.allowed) {
      this.showAlert(`Ошибка: ${contact.can_send_message.message}`, 'error');
      return;
    }

    this.contactSelected.emit(contact);
    this.hide();
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    if (typeof window !== 'undefined' && (window as any).alert) {
      (window as any).alert(message, type);
    }
  }
}