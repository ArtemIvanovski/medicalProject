from django.contrib import admin
from .models import NewsletterSubscriber, NewsletterCampaign, NewsletterSendLog


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ['email', 'is_active', 'created_at', 'ip_address']
    list_filter = ['is_active', 'created_at']
    search_fields = ['email', 'ip_address']
    readonly_fields = ['created_at', 'ip_address', 'user_agent']
    ordering = ['-created_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related()
    
    actions = ['activate_subscribers', 'deactivate_subscribers']
    
    def activate_subscribers(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} подписчиков активировано.')
    activate_subscribers.short_description = "Активировать выбранных подписчиков"
    
    def deactivate_subscribers(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} подписчиков деактивировано.')
    deactivate_subscribers.short_description = "Деактивировать выбранных подписчиков"


@admin.register(NewsletterCampaign)
class NewsletterCampaignAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject', 'status', 'created_at', 'scheduled_at', 'created_by_admin', 'success_rate']
    list_filter = ['status', 'created_at', 'scheduled_at']
    search_fields = ['title', 'subject', 'created_by_admin']
    readonly_fields = ['id', 'created_at', 'sent_at', 'total_recipients', 'successful_sends', 'failed_sends', 'success_rate']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'subject', 'status', 'created_by_admin')
        }),
        ('Содержимое', {
            'fields': ('html_content', 'plain_content')
        }),
        ('Планирование', {
            'fields': ('scheduled_at',)
        }),
        ('Статистика', {
            'fields': ('total_recipients', 'successful_sends', 'failed_sends', 'success_rate'),
            'classes': ('collapse',)
        }),
        ('Системная информация', {
            'fields': ('id', 'created_at', 'sent_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(NewsletterSendLog)
class NewsletterSendLogAdmin(admin.ModelAdmin):
    list_display = ['campaign', 'subscriber', 'status', 'sent_at']
    list_filter = ['status', 'sent_at', 'campaign']
    search_fields = ['subscriber__email', 'campaign__title']
    readonly_fields = ['id', 'sent_at']
    ordering = ['-sent_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('campaign', 'subscriber')
