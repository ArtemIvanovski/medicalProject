import jwt
import logging
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        logger.info(f"JWT Middleware called for: {request.method} {request.path}")
        
        if self.should_skip_auth(request):
            logger.info(f"Skipping auth for {request.path}")
            return self.get_response(request)

        logger.info(f"Processing auth for {request.path}")
        token = self.get_token_from_header(request)
        logger.info(f"Request path: {request.path}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Token received: {'Yes' if token else 'No'}")
        logger.info(f"Authorization header: {request.META.get('HTTP_AUTHORIZATION', 'Not found')}")

        if token:
            try:
                payload = jwt.decode(token, settings.SIMPLE_JWT['SIGNING_KEY'],
                                   algorithms=[settings.SIMPLE_JWT['ALGORITHM']])
                logger.info(f"JWT payload: {payload}")

                user_id = payload.get('user_id')
                logger.info(f"User ID from token: {user_id}")

                if user_id:
                    try:
                        # Создаем простой объект пользователя для межсервисного взаимодействия
                        class InterServiceUser:
                            def __init__(self, user_id):
                                self.id = user_id
                                self.pk = user_id
                                self.is_active = True
                                self.is_anonymous = False
                                self.username = f"user_{user_id}"
                                self.email = ""
                                self.is_staff = False
                                self.is_superuser = False
                                
                            @property
                            def is_authenticated(self):
                                return True
                                
                            def has_perm(self, perm, obj=None):
                                return True
                                
                            def has_perms(self, perm_list, obj=None):
                                return True
                                
                            def has_module_perms(self, package_name):
                                return True
                                
                        request.user = InterServiceUser(user_id)
                        logger.info(f"User authenticated with ID: {user_id}")
                    except Exception as e:
                        logger.error(f"Error setting user: {str(e)}")
                        request.user = AnonymousUser()
                else:
                    logger.error("No user_id in token payload")
                    request.user = AnonymousUser()

            except jwt.ExpiredSignatureError:
                logger.error("Token expired")
                request.user = AnonymousUser()
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid token: {str(e)}")
                request.user = AnonymousUser()
            except Exception as e:
                logger.error(f"Unexpected error in JWT middleware: {str(e)}")
                request.user = AnonymousUser()
        else:
            logger.info("No token in request, setting anonymous user")
            request.user = AnonymousUser()

        logger.info(f"Final user: {request.user} (authenticated: {request.user.is_authenticated})")
        return self.get_response(request)

    def should_skip_auth(self, request):
        # Пропускаем аутентификацию для определенных путей
        skip_paths = ['/health/', '/admin/', '/api/newsletter/']
        # Разрешаем GET запросы к блогам без аутентификации, но НЕ POST запросы
        if request.method == 'GET' and any(request.path.startswith(path) for path in ['/api/blogs/']):
            return True
        # НЕ пропускаем POST запросы к комментариям - они должны проходить через аутентификацию
        return any(request.path.startswith(path) for path in skip_paths)

    def get_token_from_header(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split(' ')[1]
        return None
