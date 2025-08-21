export interface NewsletterSubscribeRequest {
    email: string;
}

export interface NewsletterResponse {
    success: boolean;
    message: string;
    email?: string;
    errors?: { [key: string]: string[] };
}

export interface NewsletterStats {
    success: boolean;
    data?: {
        active_subscribers: number;
        total_subscribers_all_time: number;
    };
}


export interface BlogCategory {
    id: number;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    created_at: string;
}

export interface BlogTag {
    id: number;
    name: string;
    slug: string;
    created_at: string;
}

export interface BlogPost {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    content?: string;
    author_name: string;
    author_avatar_url?: string;
    status: 'draft' | 'published' | 'hidden';
    featured_image_url?: string;
    meta_title?: string;
    meta_description?: string;
    views_count: number;
    likes_count: number;
    created_at: string;
    updated_at?: string;
    published_at?: string;
    categories: BlogCategory[];
    tags: BlogTag[];
    comments_count: number;
}

export interface BlogComment {
    id: number;
    author_name: string;
    content: string;
    created_at: string;
    avatar_url: string;
    replies: BlogComment[];
}

export interface BlogPagination {
    total_items: number;
    total_pages: number;
    current_page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
}

export interface BlogListResponse {
    success: boolean;
    data: BlogPost[];
    pagination: BlogPagination;
}

export interface BlogDetailResponse {
    success: boolean;
    data: BlogPost;
}

// DRF Pagination responses для тегов и категорий
export interface DRFPaginationResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface BlogCategoriesResponse extends DRFPaginationResponse<BlogCategory> {}

export interface BlogTagsResponse extends DRFPaginationResponse<BlogTag> {}

export interface BlogCommentsResponse extends DRFPaginationResponse<BlogComment> {}

export interface BlogCommentCreateRequest {
    author_name?: string;  // Опционально для авторизованных пользователей
    author_email?: string; // Опционально для авторизованных пользователей
    content: string;
    parent?: number;
}

export interface BlogCommentCreateResponse {
    success: boolean;
    message: string;
    comment_id: number;
}

export interface BlogSearchParams {
    page?: number;
    page_size?: number;
    category?: string;
    tag?: string;
    search?: string;
}

// Contact Form Models
export interface ContactFormRequest {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

export interface ContactFormResponse {
    success: boolean;
    message: string;
    errors?: { [key: string]: string[] };
}