import jwt
import logging
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.models import AnonymousUser
from .models import User

logger = logging.getLogger(__name__)


class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self.should_skip_auth(request):
            return self.get_response(request)

        token = self.get_token_from_header(request)
        logger.info(f"Request path: {request.path}")
        logger.info(f"Token received: {'Yes' if token else 'No'}")

        if token:
            try:
                # Добавьте эти логи:
                logger.info(f"SIGNING_KEY: {settings.SIMPLE_JWT['SIGNING_KEY'][:10]}...")
                logger.info(f"ALGORITHM: {settings.SIMPLE_JWT['ALGORITHM']}")
                payload = jwt.decode(token, settings.SIMPLE_JWT['SIGNING_KEY'],
                                     algorithms=[settings.SIMPLE_JWT['ALGORITHM']])
                logger.info(f"JWT payload: {payload}")

                user_id = payload.get('user_id')
                logger.info(f"User ID from token: {user_id}")

                if user_id:
                    try:
                        request.user = User.objects.get(id=user_id, is_deleted=False)
                        logger.info(f"User found: {request.user.email}")
                    except User.DoesNotExist:
                        logger.error(f"User with ID {user_id} not found")
                        request.user = AnonymousUser()
                else:
                    logger.error("No user_id in token payload")
                    request.user = AnonymousUser()

            except jwt.ExpiredSignatureError:
                logger.error("Token expired")
                return JsonResponse({'error': 'Token expired'}, status=401)
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid token: {str(e)}")
                return JsonResponse({'error': 'Invalid token'}, status=401)
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                return JsonResponse({'error': 'Authentication error'}, status=401)
        else:
            logger.warning("No token in request")
            request.user = AnonymousUser()

        logger.info(f"Final user: {request.user} (authenticated: {request.user.is_authenticated})")
        return self.get_response(request)

    def should_skip_auth(self, request):
        skip_paths = ['/health/', '/admin/', '/avatar/']
        return any(request.path.startswith(path) for path in skip_paths)

    def get_token_from_header(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split(' ')[1]
        return None