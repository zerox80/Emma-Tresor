"""Custom authentication classes for EmmaTresor."""

from __future__ import annotations

from django.conf import settings
from rest_framework import authentication
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate JWT tokens from cookies with header fallback.

    This authentication class first attempts to authenticate using the standard
    `Authorization` header. If no token is found in the header, it falls
    back to checking for an access token in a cookie.

    The name of the cookie is configured by the `JWT_ACCESS_COOKIE_NAME`
    setting.
    """

    def authenticate(
        self, request: Request
    ) -> tuple[authentication.User, str] | None:
        """Authenticate the request.

        Args:
            request: The request object.

        Returns:
            A tuple of (user, token) if authentication is successful, or
            None otherwise.
        """
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None

        return self.get_user(validated_token), validated_token
