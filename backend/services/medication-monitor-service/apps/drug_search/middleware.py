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

        if token:
            try:
                payload = jwt.decode(token, settings.SIMPLE_JWT['SIGNING_KEY'],
                                   algorithms=[settings.SIMPLE_JWT['ALGORITHM']])

                user_id = payload.get('user_id')

                if user_id:
                    try:
                        request.user = User.objects.get(id=user_id, is_deleted=False)
                    except User.DoesNotExist:
                        request.user = AnonymousUser()
                else:
                    request.user = AnonymousUser()

            except jwt.ExpiredSignatureError:
                return JsonResponse({'error': 'Token expired'}, status=401)
            except jwt.InvalidTokenError:
                return JsonResponse({'error': 'Invalid token'}, status=401)
            except Exception:
                return JsonResponse({'error': 'Authentication error'}, status=401)
        else:
            request.user = AnonymousUser()

        return self.get_response(request)

    def should_skip_auth(self, request):
        skip_paths = ['/health/', '/admin/']
        return any(request.path.startswith(path) for path in skip_paths)

    def get_token_from_header(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split(' ')[1]
        return None