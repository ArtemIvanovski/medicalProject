from django.urls import path
from .views import (
    NotificationListCreateView, NotificationDetailView,
    NotificationPreferenceView, NotificationTemplateListView,
    mark_notifications_as_read, mark_all_as_read, unread_count
)

urlpatterns = [
    path('notifications/', NotificationListCreateView.as_view(), name='notification-list-create'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/mark-read/', mark_notifications_as_read, name='mark-notifications-read'),
    path('notifications/mark-all-read/', mark_all_as_read, name='mark-all-read'),
    path('notifications/unread-count/', unread_count, name='unread-count'),
    path('preferences/', NotificationPreferenceView.as_view(), name='notification-preferences'),
    path('templates/', NotificationTemplateListView.as_view(), name='notification-templates'),
]
