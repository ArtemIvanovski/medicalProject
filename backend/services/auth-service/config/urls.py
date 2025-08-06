from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({'status': 'healthy', 'service': 'auth-service'})


urlpatterns = [
    path('api/v1/', include('apps.authentication.urls')),
]
