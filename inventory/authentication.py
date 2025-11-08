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
    setting. This approach provides better security for web applications
    by avoiding JavaScript access to tokens while maintaining compatibility
    with API clients that use the Authorization header.
    """

    def authenticate(
        self, request: Request
    ) -> tuple[authentication.User, str] | None:
        """Authenticate the request using JWT from header or cookie.

        This method first checks for a JWT in the Authorization header.
        If not found, it falls back to checking for the token in a cookie.
        This dual approach supports both traditional API clients and web
        applications that store tokens in cookies.

        Args:
            request: The Django REST framework request object containing
                headers and cookies.

        Returns:
            tuple[authentication.User, str] | None: A tuple containing the
                authenticated user and validated token if authentication is
                successful, or None if no valid token is found.
        """
        # First try to authenticate using the standard Authorization header
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        # Fall back to cookie-based authentication
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None

        return self.get_user(validated_token), validated_token
