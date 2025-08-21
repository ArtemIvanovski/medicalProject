import {Component, OnInit, OnDestroy} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {Subject} from 'rxjs';
import {takeUntil, catchError} from 'rxjs/operators';
import {of} from 'rxjs';
import {NewsletterService} from '../../../core/services/newsletter.service';
import {AuthService} from '../../../core/services/auth.service';
import {
    BlogPost,
    BlogCategory,
    BlogTag,
    BlogComment,
    BlogCommentCreateRequest
} from '../../../core/models/newsletter.models';
import {User} from '../../../core/models/auth.models';

interface CommentForm {
    firstName: string;
    lastName: string;
    email: string;
    message: string;
}

interface ReplyForm {
    firstName: string;
    lastName: string;
    email: string;
    message: string;
    parentId: number;
}

@Component({
    selector: 'app-blog-single',
    templateUrl: './blog-single.component.html',
    styleUrls: ['./blog-single.component.scss']
})
export class BlogSingleComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    blogPost: BlogPost | null = null;
    comments: BlogComment[] = [];
    recentPosts: BlogPost[] = [];
    categories: BlogCategory[] = [];
    tags: BlogTag[] = [];

    // Navigation
    nextPost: BlogPost | null = null;
    prevPost: BlogPost | null = null;

    // Loading states
    isLoadingPost = true;
    isLoadingComments = true;
    isLoadingRecent = true;
    isLoadingCategories = true;
    isLoadingTags = true;
    isSubmittingComment = false;

    // Error states
    postNotFound = false;
    errorMessage = '';

    // Comment form
    commentForm: CommentForm = {
        firstName: '',
        lastName: '',
        email: '',
        message: ''
    };

    replyForms: { [key: number]: ReplyForm } = {};
    showReplyForm: { [key: number]: boolean } = {};
    submittingReply: { [key: number]: boolean } = {};

    currentUser: User | null = null;
    isUserAuthenticated = false;

    constructor(
        private titleService: Title,
        private route: ActivatedRoute,
        private router: Router,
        private newsletterService: NewsletterService,
        private authService: AuthService
    ) {
    }

    ngOnInit(): void {
        this.titleService.setTitle('Блог - Детали статьи');

        this.initializeAuth();

        this.route.params.subscribe(params => {
            const blogSlug = params['slug'];
            if (blogSlug) {
                this.loadBlogPost(blogSlug);
                this.loadBlogComments(blogSlug);
            }
        });

        this.loadSidebarData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeAuth(): void {
        this.isUserAuthenticated = this.authService.isAuthenticated();

        this.authService.isAuthenticated$
            .pipe(takeUntil(this.destroy$))
            .subscribe(isAuth => {
                this.isUserAuthenticated = isAuth || false;
            });

        this.authService.currentUser$
            .pipe(takeUntil(this.destroy$))
            .subscribe(user => {
                this.currentUser = user;
            });
    }

    private loadBlogPost(slug: string): void {
        this.isLoadingPost = true;
        this.postNotFound = false;

        this.newsletterService.getBlogPost(slug)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error loading blog post:', error);
                    this.postNotFound = true;
                    this.errorMessage = 'Статья не найдена';
                    return of({success: false, data: null});
                })
            )
            .subscribe(response => {
                this.isLoadingPost = false;
                if (response.success && response.data) {
                    this.blogPost = response.data;
                    this.titleService.setTitle(`${this.blogPost.title} - Блог`);
                    this.loadNavigationPosts();
                } else {
                    this.postNotFound = true;
                    this.errorMessage = 'Статья не найдена';
                }
            });
    }

    private loadBlogComments(slug: string): void {
        this.isLoadingComments = true;

        this.newsletterService.getBlogComments(slug)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error loading comments:', error);
                    return of({count: 0, next: null, previous: null, results: []});
                })
            )
            .subscribe(response => {
                this.isLoadingComments = false;
                this.comments = response.results;
            });
    }

    private loadSidebarData(): void {
        this.loadRecentPosts();
        this.loadCategories();
        this.loadTags();
    }

    private loadNavigationPosts(): void {
        // Load all posts to find previous/next
        this.newsletterService.getBlogPosts({page: 1, page_size: 100})
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error loading navigation posts:', error);
                    return of({success: false, data: [], pagination: null});
                })
            )
            .subscribe(response => {
                if (response.success && this.blogPost) {
                    const posts = response.data;
                    const currentIndex = posts.findIndex(post => post.slug === this.blogPost!.slug);

                    if (currentIndex > 0) {
                        this.prevPost = posts[currentIndex - 1];
                    }

                    if (currentIndex < posts.length - 1) {
                        this.nextPost = posts[currentIndex + 1];
                    }
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
                    return of({success: false, data: []});
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
                    return of({count: 0, next: null, previous: null, results: []});
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
                    return of({count: 0, next: null, previous: null, results: []});
                })
            )
            .subscribe(response => {
                this.isLoadingTags = false;
                this.tags = response.results;
            });
    }

    onCommentSubmit(): void {
        if (!this.blogPost || this.isSubmittingComment) return;

        // Validation based on authentication status
        if (this.isUserAuthenticated) {
            // For authenticated users, only message is required
            if (!this.commentForm.message.trim()) {
                alert('Пожалуйста, напишите комментарий');
                return;
            }
        } else {
            // For anonymous users, all fields are required
            if (!this.commentForm.firstName || !this.commentForm.lastName ||
                !this.commentForm.email || !this.commentForm.message) {
                alert('Пожалуйста, заполните все поля');
                return;
            }
        }

        this.isSubmittingComment = true;

        let commentData: BlogCommentCreateRequest;

        if (this.isUserAuthenticated) {
            // For authenticated users, only send content
            commentData = {
                content: this.commentForm.message
            };
        } else {
            // For anonymous users, send all data
            commentData = {
                author_name: `${this.commentForm.firstName} ${this.commentForm.lastName}`,
                author_email: this.commentForm.email,
                content: this.commentForm.message
            };
        }

        this.newsletterService.createBlogComment(this.blogPost.slug, commentData)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error submitting comment:', error);
                    alert('Ошибка при отправке комментария. Попробуйте еще раз.');
                    return of({success: false, message: 'Error', comment_id: 0});
                })
            )
            .subscribe(response => {
                this.isSubmittingComment = false;
                if (response.success) {
                    alert(response.message);
                    this.resetCommentForm();
                    // Reload comments to show the new one if approved
                    if (this.blogPost) {
                        this.loadBlogComments(this.blogPost.slug);
                    }
                }
            });
    }

    resetCommentForm(): void {
        this.commentForm = {
            firstName: '',
            lastName: '',
            email: '',
            message: ''
        };
    }

    goToBlogsGrid(): void {
        this.router.navigate(['/home/blogs-grid']);
    }

    onSearch(event: any): void {
        const searchTerm = event.target.value;
        if (searchTerm.trim()) {
            this.router.navigate(['/home/blogs-grid'], {
                queryParams: {search: searchTerm.trim()}
            });
        }
    }

    onRecentPostClick(post: BlogPost): void {
        this.router.navigate(['/home/blog-single', post.slug]);
    }

    onCategoryClick(category: BlogCategory): void {
        this.router.navigate(['/home/blogs-grid'], {
            queryParams: {category: category.slug}
        });
    }

    onTagClick(tag: BlogTag): void {
        this.router.navigate(['/home/blogs-grid'], {
            queryParams: {tag: tag.slug}
        });
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    formatDateTime(dateString: string): { date: string, time: string } {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            }),
            time: date.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }

    getContentParagraphs(): string[] {
        if (!this.blogPost?.content) return [];
        return this.blogPost.content.split('\n\n').filter(p => p.trim());
    }

    // Reply methods
    showReplyToComment(commentId: number): void {
        this.showReplyForm[commentId] = true;
        if (!this.replyForms[commentId]) {
            this.replyForms[commentId] = {
                firstName: '',
                lastName: '',
                email: '',
                message: '',
                parentId: commentId
            };
        }
    }

    getReplyForm(commentId: number): ReplyForm {
        if (!this.replyForms[commentId]) {
            this.replyForms[commentId] = {
                firstName: '',
                lastName: '',
                email: '',
                message: '',
                parentId: commentId
            };
        }
        return this.replyForms[commentId];
    }

    hideReplyToComment(commentId: number): void {
        this.showReplyForm[commentId] = false;
    }

    onReplySubmit(commentId: number): void {
        if (!this.blogPost || this.submittingReply[commentId]) return;

        const replyForm = this.getReplyForm(commentId);

        // Validation based on authentication status
        if (this.isUserAuthenticated) {
            if (!replyForm.message.trim()) {
                alert('Пожалуйста, напишите ответ');
                return;
            }
        } else {
            if (!replyForm.firstName || !replyForm.lastName ||
                !replyForm.email || !replyForm.message) {
                alert('Пожалуйста, заполните все поля');
                return;
            }
        }

        this.submittingReply[commentId] = true;

        let replyData: BlogCommentCreateRequest;

        if (this.isUserAuthenticated) {
            // For authenticated users, only send content and parent
            replyData = {
                content: replyForm.message,
                parent: commentId
            };
        } else {
            // For anonymous users, send all data
            replyData = {
                author_name: `${replyForm.firstName} ${replyForm.lastName}`,
                author_email: replyForm.email,
                content: replyForm.message,
                parent: commentId
            };
        }

        this.newsletterService.createBlogComment(this.blogPost.slug, replyData)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error submitting reply:', error);
                    alert('Ошибка при отправке ответа. Попробуйте еще раз.');
                    return of({success: false, message: 'Error', comment_id: 0});
                })
            )
            .subscribe(response => {
                this.submittingReply[commentId] = false;
                if (response.success) {
                    alert(response.message);
                    this.hideReplyToComment(commentId);
                    this.resetReplyForm(commentId);
                    // Reload comments to show the new reply if approved
                    if (this.blogPost) {
                        this.loadBlogComments(this.blogPost.slug);
                    }
                }
            });
    }

    resetReplyForm(commentId: number): void {
        const form = this.getReplyForm(commentId);
        form.firstName = '';
        form.lastName = '';
        form.email = '';
        form.message = '';
        form.parentId = commentId;
    }

    goToPreviousPost(): void {
        if (this.prevPost) {
            this.router.navigate(['/home/blog-single', this.prevPost.slug]);
        }
    }

    goToNextPost(): void {
        if (this.nextPost) {
            this.router.navigate(['/home/blog-single', this.nextPost.slug]);
        }
    }
}
