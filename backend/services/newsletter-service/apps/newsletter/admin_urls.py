from django.urls import path
from . import admin_views

urlpatterns = [
    # Управление подписчиками
    path('subscribers/', admin_views.admin_subscribers_list, name='admin-subscribers-list'),
    path('subscribers/<int:subscriber_id>/delete/', admin_views.admin_subscriber_delete, name='admin-subscriber-delete'),
    path('subscribers/bulk-delete/', admin_views.admin_subscribers_bulk_delete, name='admin-subscribers-bulk-delete'),
    
    # Управление кампаниями
    path('campaigns/', admin_views.admin_campaigns_list, name='admin-campaigns-list'),
    path('campaigns/create/', admin_views.admin_campaign_create, name='admin-campaign-create'),
    path('campaigns/<uuid:campaign_id>/', admin_views.admin_campaign_detail, name='admin-campaign-detail'),
    path('campaigns/<uuid:campaign_id>/send/', admin_views.admin_campaign_send, name='admin-campaign-send'),
    path('campaigns/<uuid:campaign_id>/cancel/', admin_views.admin_campaign_cancel, name='admin-campaign-cancel'),
    path('campaigns/<uuid:campaign_id>/delete/', admin_views.admin_campaign_delete, name='admin-campaign-delete'),
    
    # Логи отправки
    path('send-logs/', admin_views.admin_send_logs, name='admin-send-logs'),
    
    # Статистика
    path('stats/', admin_views.admin_newsletter_stats, name='admin-newsletter-stats'),
]
