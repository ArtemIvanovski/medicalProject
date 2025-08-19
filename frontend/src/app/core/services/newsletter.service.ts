import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {NewsletterResponse, NewsletterStats, NewsletterSubscribeRequest} from "../models/newsletter.models";


@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  private apiUrl = environment.newsletterApiUrl;

  constructor(private http: HttpClient) {}

  subscribe(email: string): Observable<NewsletterResponse> {
    const data: NewsletterSubscribeRequest = { email: email.trim().toLowerCase() };
    return this.http.post<NewsletterResponse>(`${this.apiUrl}/subscribe/`, data);
  }

  unsubscribe(email: string): Observable<NewsletterResponse> {
    const data: NewsletterSubscribeRequest = { email: email.trim().toLowerCase() };
    return this.http.post<NewsletterResponse>(`${this.apiUrl}/unsubscribe/`, data);
  }

  /**
   * Получение статистики подписок
   */
  getStats(): Observable<NewsletterStats> {
    return this.http.get<NewsletterStats>(`${this.apiUrl}/stats/`);
  }

  /**
   * Валидация email адреса
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Проверка на подозрительные домены
   */
  isSuspiciousDomain(email: string): boolean {
    const suspiciousDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return suspiciousDomains.includes(domain);
  }
}
