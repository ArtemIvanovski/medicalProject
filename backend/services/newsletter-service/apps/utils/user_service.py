import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class UserService:
    """Сервис для работы с пользователями через patient-service"""

    def __init__(self):
        # URL patient-service (предполагаем, что он работает на порту 8002)
        self.patient_service_url = settings.PATIENT_SERVICE_URL
    
    def get_user_display_name(self, user_info: dict) -> str:
        """
        Формирует отображаемое имя пользователя из данных
        
        Args:
            user_info: Словарь с данными пользователя
            
        Returns:
            str: Отформатированное имя пользователя
        """
        if not user_info:
            return "Аноним"
            
        first_name = user_info.get('first_name', '').strip()
        last_name = user_info.get('last_name', '').strip()
        email = user_info.get('email', '').strip()
        username = user_info.get('username', '').strip()
        
        # Приоритет: Имя + Фамилия > username > email > ID
        if first_name and last_name:
            return f"{first_name} {last_name}"
        elif first_name:
            return first_name
        elif username:
            return username
        elif email:
            return email.split('@')[0]  # Берем часть до @
        else:
            return "Пользователь"

    def get_user_avatar_url(self, user_id: str) -> str:
        """
        Получает URL аватарки пользователя по его ID
        
        Args:
            user_id: UUID пользователя
            
        Returns:
            str: URL аватарки или None если не найдена
        """
        if not user_id:
            return self.get_default_avatar_url()

        try:
            # Делаем запрос к patient-service для получения аватарки пользователя
            url = f"{self.patient_service_url}/api/v1/user/{user_id}/avatar/"
            logger.info(f"Requesting user avatar from: {url}")
            response = requests.get(url, timeout=5)

            logger.info(f"Avatar response status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Avatar response data: {data}")
                avatar_url = data.get('avatar_url', self.get_default_avatar_url())
                
                # Если URL относительный, делаем его абсолютным
                if avatar_url and avatar_url.startswith('/api/'):
                    avatar_url = f"{self.patient_service_url}{avatar_url}"
                
                return avatar_url
            elif response.status_code == 404:
                # Пользователь не найден или у него нет аватарки
                logger.info(f"User {user_id} not found or no avatar, using default")
                return self.get_default_avatar_url()
            else:
                logger.warning(f"Failed to get user avatar for {user_id}: {response.status_code}")
                return self.get_default_avatar_url()

        except requests.exceptions.RequestException as e:
            logger.error(f"Error connecting to patient-service for user {user_id}: {str(e)}")
            return self.get_default_avatar_url()

    def get_default_avatar_url(self) -> str:
        """Возвращает URL дефолтной аватарки"""
        return "/assets/img/author1.jpg"

    def get_user_info(self, user_id: str) -> dict:
        """
        Получает информацию о пользователе по его ID
        
        Args:
            user_id: UUID пользователя
            
        Returns:
            dict: Информация о пользователе или None если не найден
        """
        if not user_id:
            return None

        try:
            url = f"{self.patient_service_url}/api/v1/user/{user_id}/"
            logger.info(f"Requesting user info from: {url}")
            response = requests.get(url, timeout=5)

            logger.info(f"User info response status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.info(f"User info response data: {data}")
                return data
            else:
                logger.warning(f"Failed to get user info for {user_id}: {response.status_code}")
                return None

        except requests.exceptions.RequestException as e:
            logger.error(f"Error connecting to patient-service for user info {user_id}: {str(e)}")
            return None
