from typing import Optional, Tuple

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication


class MiddlewareUserAuthentication(BaseAuthentication):
    """DRF auth class that trusts the user set by middleware.

    If the underlying Django HttpRequest (request._request) has an authenticated
    user set by upstream middleware, return it without CSRF checks.
    """

    def authenticate(self, request) -> Optional[Tuple[object, None]]:
        django_request = getattr(request, "_request", None)
        if not django_request:
            return None

        user = getattr(django_request, "user", None)
        if user and not isinstance(user, AnonymousUser) and getattr(user, "is_authenticated", False):
            return (user, None)

        return None


