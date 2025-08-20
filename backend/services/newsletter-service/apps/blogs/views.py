from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.paginator import Paginator
from django.db.models import Q, F
from django.shortcuts import get_object_or_404
from .models import BlogPost, BlogCategory, BlogTag, BlogComment, BlogImage
from .serializers import (
    BlogPostListSerializer,
    BlogPostDetailSerializer,
    BlogPostCreateUpdateSerializer,
    BlogCategorySerializer,
    BlogTagSerializer,
    BlogCommentSerializer,
    BlogPostActionSerializer,
    BlogCommentCreateSerializer,
    BlogImageSerializer
)
from ..utils.drive_service import DriveService

class BlogPostListView(generics.ListAPIView):
    serializer_class = BlogPostListSerializer
    
    def get_queryset(self):
        queryset = BlogPost.objects.filter(status='published').select_related().prefetch_related('categories', 'tags')
        
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(categories__slug=category)
            
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__slug=tag)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search) |
                Q(excerpt__icontains=search)
            )
            
        return queryset.distinct()
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        page_size = int(request.query_params.get('page_size', 6))
        page_number = int(request.query_params.get('page', 1))
        
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)
        
        serializer = self.get_serializer(page.object_list, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'pagination': {
                'total_items': paginator.count,
                'total_pages': paginator.num_pages,
                'current_page': page_number,
                'page_size': page_size,
                'has_next': page.has_next(),
                'has_previous': page.has_previous()
            }
        })

class BlogPostDetailView(generics.RetrieveAPIView):
    queryset = BlogPost.objects.filter(status='published')
    serializer_class = BlogPostDetailSerializer
    lookup_field = 'slug'
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        BlogPost.objects.filter(id=instance.id).update(views_count=F('views_count') + 1)
        
        if request.META.get('REMOTE_ADDR'):
            from .models import BlogView
            BlogView.objects.create(
                post=instance,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                referrer=request.META.get('HTTP_REFERER')
            )
        
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })

class BlogPostAdminListView(generics.ListAPIView):
    serializer_class = BlogPostListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = BlogPost.objects.all().select_related().prefetch_related('categories', 'tags')
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(author_name__icontains=search)
            )
            
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        page_size = int(request.query_params.get('page_size', 20))
        page_number = int(request.query_params.get('page', 1))
        
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)
        
        serializer = self.get_serializer(page.object_list, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'pagination': {
                'total_items': paginator.count,
                'total_pages': paginator.num_pages,
                'current_page': page_number,
                'page_size': page_size,
                'has_next': page.has_next(),
                'has_previous': page.has_previous()
            }
        })

class BlogPostCreateView(generics.CreateAPIView):
    serializer_class = BlogPostCreateUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        post = serializer.save()
        
        return Response({
            'success': True,
            'message': 'Блог пост успешно создан',
            'data': BlogPostDetailSerializer(post).data
        }, status=status.HTTP_201_CREATED)

class BlogPostUpdateView(generics.UpdateAPIView):
    queryset = BlogPost.objects.all()
    serializer_class = BlogPostCreateUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        post = serializer.save()
        
        return Response({
            'success': True,
            'message': 'Блог пост успешно обновлен',
            'data': BlogPostDetailSerializer(post).data
        })

class BlogPostDeleteView(generics.UpdateAPIView):
    queryset = BlogPost.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = BlogPostActionSerializer
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        action = request.data.get('action')
        
        if action == 'hide':
            instance.status = 'hidden'
            message = 'Блог пост скрыт'
        elif action == 'restore':
            instance.status = 'published'
            message = 'Блог пост восстановлен'
        else:
            return Response({
                'success': False,
                'message': 'Неверное действие'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        instance.save()
        
        return Response({
            'success': True,
            'message': message
        })

class BlogCategoryListView(generics.ListCreateAPIView):
    queryset = BlogCategory.objects.all()
    serializer_class = BlogCategorySerializer
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return []

class BlogTagListView(generics.ListCreateAPIView):
    queryset = BlogTag.objects.all()
    serializer_class = BlogTagSerializer
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return []

class BlogCommentListView(generics.ListAPIView):
    serializer_class = BlogCommentSerializer
    
    def get_queryset(self):
        post_slug = self.kwargs['post_slug']
        post = get_object_or_404(BlogPost, slug=post_slug, status='published')
        return BlogComment.objects.filter(
            post=post, 
            status='approved',
            parent__isnull=True
        ).select_related('post').prefetch_related('replies')

class BlogCommentCreateView(generics.CreateAPIView):
    serializer_class = BlogCommentCreateSerializer
    
    def create(self, request, *args, **kwargs):
        post_slug = kwargs['post_slug']
        post = get_object_or_404(BlogPost, slug=post_slug, status='published')
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        comment = serializer.save(
            post=post,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({
            'success': True,
            'message': 'Комментарий отправлен на модерацию',
            'comment_id': comment.id
        }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_blog_image(request):
    if 'image' not in request.FILES:
        return Response({
            'success': False,
            'message': 'Файл изображения не найден'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    image_file = request.FILES['image']
    post_id = request.data.get('post_id')
    
    if not post_id:
        return Response({
            'success': False,
            'message': 'ID поста обязателен'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        post = BlogPost.objects.get(id=post_id)
        drive_service = DriveService()
        drive_id = drive_service.upload_image(image_file)
        
        blog_image = BlogImage.objects.create(
            post=post,
            drive_id=drive_id,
            alt_text=request.data.get('alt_text', ''),
            caption=request.data.get('caption', ''),
            sort_order=request.data.get('sort_order', 0)
        )
        
        serializer = BlogImageSerializer(blog_image)
        
        return Response({
            'success': True,
            'message': 'Изображение успешно загружено',
            'data': serializer.data
        })
        
    except BlogPost.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Пост не найден'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Ошибка загрузки: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
