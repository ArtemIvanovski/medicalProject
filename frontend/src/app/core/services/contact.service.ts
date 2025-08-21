import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactFormRequest, ContactFormResponse } from '../models/newsletter.models';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private contactApiUrl = 'http://localhost:8007/api/contacts'; // Правильный URL для контактов

  constructor(private http: HttpClient) {}

  sendContactMessage(data: ContactFormRequest): Observable<ContactFormResponse> {
    return this.http.post<ContactFormResponse>(`${this.contactApiUrl}/create/`, data);
  }
}
