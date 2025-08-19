from django.urls import path, include
from . import views

urlpatterns = [
    # Публичные URL
    path('subscribe/', views.subscribe_newsletter, name='newsletter-subscribe'),
    path('unsubscribe/', views.unsubscribe_newsletter, name='newsletter-unsubscribe'),
    path('stats/', views.newsletter_stats, name='newsletter-stats'),
    
    # Админские URL
    path('admin/', include('apps.newsletter.admin_urls')),
]
