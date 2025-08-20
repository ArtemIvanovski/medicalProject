from django.contrib import admin
from .models import (
    BlogCategory, BlogTag, BlogPost, BlogComment, 
    BlogImage, BlogView, BlogPostCategory, BlogPostTag
)

@admin.register(BlogCategory)
class BlogCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'color', 'created_at']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name']

@admin.register(BlogTag)
class BlogTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'created_at']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name']

class BlogImageInline(admin.TabularInline):
    model = BlogImage
    extra = 0
    fields = ['drive_id', 'alt_text', 'caption', 'sort_order']

class BlogPostCategoryInline(admin.TabularInline):
    model = BlogPostCategory
    extra = 0

class BlogPostTagInline(admin.TabularInline):
    model = BlogPostTag
    extra = 0

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author_name', 'status', 'views_count', 'created_at']
    list_filter = ['status', 'created_at', 'categories']
    search_fields = ['title', 'content', 'author_name']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['views_count', 'likes_count', 'created_at', 'updated_at']
    list_editable = ['status']
    inlines = [BlogPostCategoryInline, BlogPostTagInline, BlogImageInline]
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'slug', 'content', 'excerpt', 'status')
        }),
        ('Автор', {
            'fields': ('author_name', 'author_avatar_drive_id')
        }),
        ('Медиа', {
            'fields': ('featured_image_drive_id',)
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('collapse',)
        }),
        ('Статистика', {
            'fields': ('views_count', 'likes_count'),
            'classes': ('collapse',)
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at', 'published_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(BlogComment)
class BlogCommentAdmin(admin.ModelAdmin):
    list_display = ['author_name', 'post', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['author_name', 'author_email', 'content']
    readonly_fields = ['created_at', 'updated_at', 'ip_address', 'user_agent']
    list_editable = ['status']

@admin.register(BlogView)
class BlogViewAdmin(admin.ModelAdmin):
    list_display = ['post', 'ip_address', 'created_at']
    list_filter = ['created_at']
    readonly_fields = ['post', 'ip_address', 'user_agent', 'referrer', 'created_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
