import { Component, OnInit, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { BlogPost, BlogCategory, BlogTag, BlogPagination } from '../../../core/models/newsletter.models';

@Component({
  selector: 'app-blogs-grid-example',
  templateUrl: './blogs-grid-example.component.html',
  styleUrls: ['./blogs-grid-example.component.scss']
})
export class BlogsGridExampleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  blogPosts: BlogPost[] = [];
  recentPosts: BlogPost[] = [];
  categories: BlogCategory[] = [];
  tags: BlogTag[] = [];
  pagination: BlogPagination | null = null;
  
  // Loading states
  isLoading = true;
  isLoadingRecent = true;
  isLoadingCategories = true;
  isLoadingTags = true;
  
  // Current page and search
  currentPage = 1;
  currentSearch = '';
  selectedCategory: string | null = null;
  selectedTag: string | null = null;

  constructor(
    private titleService: Title,
    private router: Router,
    private newsletterService: NewsletterService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Блог - Пример с API');
    this.loadBlogData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBlogData(): void {
    this.loadBlogPosts();
    this.loadRecentPosts();
    this.loadCategories();
    this.loadTags();
  }

  private loadBlogPosts(): void {
    this.isLoading = true;
    const params: any = {
      page: this.currentPage,
      page_size: 6
    };
    
    if (this.currentSearch) {
      params.search = this.currentSearch;
    }
    
    if (this.selectedCategory) {
      params.category = this.selectedCategory;
    }
    
    if (this.selectedTag) {
      params.tag = this.selectedTag;
    }

    this.newsletterService.getBlogPosts(params)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading blog posts:', error);
          return of({ success: false, data: [], pagination: null });
        })
      )
      .subscribe(response => {
        this.isLoading = false;
        if (response.success) {
          this.blogPosts = response.data;
          this.pagination = response.pagination;
        }
      });
  }

  private loadRecentPosts(): void {
    this.isLoadingRecent = true;
    this.newsletterService.getRecentBlogPosts(3)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading recent posts:', error);
          return of({ success: false, data: [] });
        })
      )
      .subscribe(response => {
        this.isLoadingRecent = false;
        if (response.success) {
          this.recentPosts = response.data;
        }
      });
  }

  private loadCategories(): void {
    this.isLoadingCategories = true;
    this.newsletterService.getBlogCategories()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading categories:', error);
          return of({ count: 0, next: null, previous: null, results: [] });
        })
      )
      .subscribe(response => {
        this.isLoadingCategories = false;
        this.categories = response.results;
      });
  }

  private loadTags(): void {
    this.isLoadingTags = true;
    this.newsletterService.getBlogTags()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading tags:', error);
          return of({ count: 0, next: null, previous: null, results: [] });
        })
      )
      .subscribe(response => {
        this.isLoadingTags = false;
        this.tags = response.results;
      });
  }

  onBlogClick(blogSlug: string): void {
    this.router.navigate(['/home/blog-single', blogSlug]);
  }

  onSearch(event: any): void {
    const searchTerm = event.target.value.trim();
    this.currentSearch = searchTerm;
    this.currentPage = 1;
    this.loadBlogPosts();
  }

  onCategoryClick(category: BlogCategory): void {
    this.selectedCategory = category.slug;
    this.selectedTag = null;
    this.currentPage = 1;
    this.loadBlogPosts();
  }

  onTagClick(tag: BlogTag): void {
    this.selectedTag = tag.slug;
    this.selectedCategory = null;
    this.currentPage = 1;
    this.loadBlogPosts();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= (this.pagination?.total_pages || 1)) {
      this.currentPage = page;
      this.loadBlogPosts();
    }
  }

  onPreviousPage(): void {
    if (this.pagination?.has_previous) {
      this.onPageChange(this.currentPage - 1);
    }
  }

  onNextPage(): void {
    if (this.pagination?.has_next) {
      this.onPageChange(this.currentPage + 1);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getPageNumbers(): number[] {
    if (!this.pagination) return [];
    
    const totalPages = this.pagination.total_pages;
    const currentPage = this.pagination.current_page;
    const pages: number[] = [];
    
    // Show max 5 pages around current page
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}