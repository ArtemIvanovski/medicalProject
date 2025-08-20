from django.urls import path
from .views import (
    BlogPostListView,
    BlogPostDetailView,
    BlogPostAdminListView,
    BlogPostCreateView,
    BlogPostUpdateView,
    BlogPostDeleteView,
    BlogCategoryListView,
    BlogTagListView,
    BlogCommentListView,
    BlogCommentCreateView,
    upload_blog_image
)

urlpatterns = [
    path('posts/', BlogPostListView.as_view(), name='blog-post-list'),
    path('posts/<slug:slug>/', BlogPostDetailView.as_view(), name='blog-post-detail'),
    
    path('admin/posts/', BlogPostAdminListView.as_view(), name='blog-post-admin-list'),
    path('admin/posts/create/', BlogPostCreateView.as_view(), name='blog-post-create'),
    path('admin/posts/<int:pk>/update/', BlogPostUpdateView.as_view(), name='blog-post-update'),
    path('admin/posts/<int:pk>/delete/', BlogPostDeleteView.as_view(), name='blog-post-delete'),
    
    path('categories/', BlogCategoryListView.as_view(), name='blog-category-list'),
    path('tags/', BlogTagListView.as_view(), name='blog-tag-list'),
    
    path('posts/<slug:post_slug>/comments/', BlogCommentListView.as_view(), name='blog-comment-list'),
    path('posts/<slug:post_slug>/comments/create/', BlogCommentCreateView.as_view(), name='blog-comment-create'),
    
    path('admin/upload-image/', upload_blog_image, name='blog-upload-image'),
]
