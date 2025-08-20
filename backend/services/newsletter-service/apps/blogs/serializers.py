from rest_framework import serializers
from .models import BlogPost, BlogCategory, BlogTag, BlogComment, BlogImage
from ..utils.drive_service import DriveService

class BlogCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogCategory
        fields = '__all__'
        read_only_fields = ['slug', 'created_at']

class BlogTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogTag
        fields = '__all__'
        read_only_fields = ['slug', 'created_at']

class BlogImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = BlogImage
        fields = ['id', 'drive_id', 'alt_text', 'caption', 'sort_order', 'image_url']
        
    def get_image_url(self, obj):
        return DriveService().get_image_url(obj.drive_id)

class BlogPostListSerializer(serializers.ModelSerializer):
    featured_image_url = serializers.SerializerMethodField()
    author_avatar_url = serializers.SerializerMethodField()
    categories = BlogCategorySerializer(many=True, read_only=True)
    tags = BlogTagSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'excerpt', 'author_name', 'author_avatar_url',
            'status', 'featured_image_url', 'views_count', 'likes_count',
            'created_at', 'published_at', 'categories', 'tags', 'comments_count'
        ]
        
    def get_featured_image_url(self, obj):
        return DriveService().get_image_url(obj.featured_image_drive_id)
        
    def get_author_avatar_url(self, obj):
        return DriveService().get_image_url(obj.author_avatar_drive_id)
        
    def get_comments_count(self, obj):
        return obj.comments.filter(status='approved').count()

class BlogPostDetailSerializer(serializers.ModelSerializer):
    featured_image_url = serializers.SerializerMethodField()
    author_avatar_url = serializers.SerializerMethodField()
    categories = BlogCategorySerializer(many=True, read_only=True)
    tags = BlogTagSerializer(many=True, read_only=True)
    images = BlogImageSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'content', 'excerpt', 'author_name', 
            'author_avatar_url', 'status', 'featured_image_url', 'meta_title',
            'meta_description', 'views_count', 'likes_count', 'created_at',
            'updated_at', 'published_at', 'categories', 'tags', 'images',
            'comments_count'
        ]
        
    def get_featured_image_url(self, obj):
        return DriveService().get_image_url(obj.featured_image_drive_id)
        
    def get_author_avatar_url(self, obj):
        return DriveService().get_image_url(obj.author_avatar_drive_id)
        
    def get_comments_count(self, obj):
        return obj.comments.filter(status='approved').count()

class BlogPostCreateUpdateSerializer(serializers.ModelSerializer):
    category_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    tag_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    featured_image = serializers.ImageField(write_only=True, required=False)
    author_avatar = serializers.ImageField(write_only=True, required=False)
    
    class Meta:
        model = BlogPost
        fields = [
            'title', 'content', 'excerpt', 'author_name', 'status',
            'meta_title', 'meta_description', 'category_ids', 'tag_ids',
            'featured_image', 'author_avatar'
        ]
        
    def create(self, validated_data):
        category_ids = validated_data.pop('category_ids', [])
        tag_ids = validated_data.pop('tag_ids', [])
        featured_image = validated_data.pop('featured_image', None)
        author_avatar = validated_data.pop('author_avatar', None)
        
        drive_service = DriveService()
        
        if featured_image:
            validated_data['featured_image_drive_id'] = drive_service.upload_image(featured_image)
            
        if author_avatar:
            validated_data['author_avatar_drive_id'] = drive_service.upload_image(author_avatar)
            
        post = BlogPost.objects.create(**validated_data)
        
        if category_ids:
            post.categories.set(category_ids)
        if tag_ids:
            post.tags.set(tag_ids)
            
        return post
        
    def update(self, instance, validated_data):
        category_ids = validated_data.pop('category_ids', None)
        tag_ids = validated_data.pop('tag_ids', None)
        featured_image = validated_data.pop('featured_image', None)
        author_avatar = validated_data.pop('author_avatar', None)
        
        drive_service = DriveService()
        
        if featured_image:
            old_drive_id = instance.featured_image_drive_id
            validated_data['featured_image_drive_id'] = drive_service.upload_image(
                featured_image, old_drive_id
            )
            
        if author_avatar:
            old_drive_id = instance.author_avatar_drive_id
            validated_data['author_avatar_drive_id'] = drive_service.upload_image(
                author_avatar, old_drive_id
            )
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if category_ids is not None:
            instance.categories.set(category_ids)
        if tag_ids is not None:
            instance.tags.set(tag_ids)
            
        return instance

class BlogCommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()
    
    class Meta:
        model = BlogComment
        fields = [
            'id', 'author_name', 'content', 'created_at', 'replies'
        ]
        
    def get_replies(self, obj):
        if obj.replies.filter(status='approved').exists():
            return BlogCommentSerializer(
                obj.replies.filter(status='approved'), 
                many=True
            ).data
        return []

class BlogCommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogComment
        fields = ['author_name', 'author_email', 'content', 'parent']
        
    def validate_author_email(self, value):
        return value.lower().strip()

class BlogPostActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['hide', 'restore'])
    
    def validate_action(self, value):
        if value not in ['hide', 'restore']:
            raise serializers.ValidationError("Action must be 'hide' or 'restore'")
        return value