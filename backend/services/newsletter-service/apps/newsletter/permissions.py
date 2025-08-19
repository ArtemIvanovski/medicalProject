from rest_framework import permissions
import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class IsAdminUser(permissions.BasePermission):
    """
    Разрешение только для администраторов.
    Проверяет роль пользователя через auth-service.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Получаем токен из заголовка
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header or not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            # Проверяем роли пользователя через auth-service
            auth_url = f"http://auth-service:8000/api/v1/auth/profile/"
            headers = {'Authorization': f'Bearer {token}'}
            
            response = requests.get(auth_url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                user_data = response.json()
                user_roles = user_data.get('roles', [])
                
                # Проверяем есть ли роль ADMIN
                if 'ADMIN' in user_roles:
                    return True
                    
            logger.warning(f"Admin access denied for user. Response: {response.status_code}")
            return False
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error checking admin permissions: {e}")
            return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Разрешение на чтение для всех, изменение только для админов.
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return IsAdminUser().has_permission(request, view)
