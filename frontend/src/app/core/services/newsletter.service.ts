import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NewsletterResponse, 
  NewsletterStats, 
  NewsletterSubscribeRequest,
  BlogListResponse,
  BlogDetailResponse,
  BlogCategoriesResponse,
  BlogTagsResponse,
  BlogCommentsResponse,
  BlogCommentCreateRequest,
  BlogCommentCreateResponse,
  BlogSearchParams
} from "../models/newsletter.models";


@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  private newsletterApiUrl = environment.newsletterApiUrl;
  private blogApiUrl = environment.blogApiUrl;

  constructor(private http: HttpClient) {}

  subscribe(email: string): Observable<NewsletterResponse> {
    const data: NewsletterSubscribeRequest = { email: email.trim().toLowerCase() };
    return this.http.post<NewsletterResponse>(`${this.newsletterApiUrl}/subscribe/`, data);
  }

  unsubscribe(email: string): Observable<NewsletterResponse> {
    const data: NewsletterSubscribeRequest = { email: email.trim().toLowerCase() };
    return this.http.post<NewsletterResponse>(`${this.newsletterApiUrl}/unsubscribe/`, data);
  }

  getStats(): Observable<NewsletterStats> {
    return this.http.get<NewsletterStats>(`${this.newsletterApiUrl}/stats/`);
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }

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

  // Blog methods
  getBlogPosts(params?: BlogSearchParams): Observable<BlogListResponse> {
    let queryParams = '';
    
    if (params) {
      const queryArray: string[] = [];
      
      if (params.page) queryArray.push(`page=${params.page}`);
      if (params.page_size) queryArray.push(`page_size=${params.page_size}`);
      if (params.category) queryArray.push(`category=${encodeURIComponent(params.category)}`);
      if (params.tag) queryArray.push(`tag=${encodeURIComponent(params.tag)}`);
      if (params.search) queryArray.push(`search=${encodeURIComponent(params.search)}`);
      
      if (queryArray.length > 0) {
        queryParams = '?' + queryArray.join('&');
      }
    }
    
    return this.http.get<BlogListResponse>(`${this.blogApiUrl}/posts/${queryParams}`);
  }

  getBlogPost(slug: string): Observable<BlogDetailResponse> {
    return this.http.get<BlogDetailResponse>(`${this.blogApiUrl}/posts/${slug}/`);
  }

  getBlogCategories(): Observable<BlogCategoriesResponse> {
    return this.http.get<BlogCategoriesResponse>(`${this.blogApiUrl}/categories/`);
  }

  getBlogTags(): Observable<BlogTagsResponse> {
    return this.http.get<BlogTagsResponse>(`${this.blogApiUrl}/tags/`);
  }

  getBlogComments(postSlug: string): Observable<BlogCommentsResponse> {
    return this.http.get<BlogCommentsResponse>(`${this.blogApiUrl}/posts/${postSlug}/comments/`);
  }

  createBlogComment(postSlug: string, commentData: BlogCommentCreateRequest): Observable<BlogCommentCreateResponse> {
    return this.http.post<BlogCommentCreateResponse>(`${this.blogApiUrl}/posts/${postSlug}/comments/create/`, commentData);
  }

  getRecentBlogPosts(limit: number = 3): Observable<BlogListResponse> {
    return this.getBlogPosts({ page: 1, page_size: limit });
  }
}
