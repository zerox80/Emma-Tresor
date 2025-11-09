# JWT Authentication with Cookie Support
# ======================================
# This custom authentication class extends Django REST Framework's JWT authentication
# to support token transmission via HTTP cookies in addition to the standard
# Authorization header. This provides better security by avoiding JavaScript
# access to tokens and enables more seamless authentication in web applications.

from __future__ import annotations                   # Enable forward references for type hints
from django.conf import settings                     # Django settings configuration
from rest_framework import authentication            # REST Framework authentication base classes
from rest_framework.request import Request           # REST Framework request object type
from rest_framework_simplejwt.authentication import JWTAuthentication  # JWT authentication base class
from rest_framework_simplejwt.exceptions import InvalidToken           # JWT validation error

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication class that supports both header and cookie-based tokens.

    This class provides flexible token authentication by:
    1. First attempting to authenticate via the standard Authorization header
    2. Falling back to cookie-based authentication if no header is present
    3. Gracefully handling invalid or missing tokens

    This approach supports both traditional API clients (using headers) and
    web applications (using cookies) with a single authentication backend.
    """

    def authenticate(self, request: Request) -> tuple[authentication.User, str] | None:
        """
        Authenticate the request using JWT from header or cookie.

        This method implements a dual authentication strategy:
        1. Try to authenticate using the Authorization header first (standard approach)
        2. If no header, try to authenticate using cookies (web app approach)
        3. Return None if authentication fails or no token is found

        Args:
            request: The incoming HTTP request object containing headers and cookies

        Returns:
            tuple[User, str]: A tuple containing the authenticated user and validated token
            None: If authentication fails or no token is present

        Authentication Flow:
        1. Check for Authorization header with Bearer token
        2. If found, delegate to parent class for standard JWT authentication
        3. If no header, check for JWT token in cookies
        4. Validate the cookie token and authenticate the user
        5. Return None if both methods fail
        """
        # Attempt standard header-based authentication first
        # This maintains compatibility with API clients that use Authorization: Bearer <token>
        header = self.get_header(request)
        if header is not None:
            # If header is present, use the parent class authentication method
            return super().authenticate(request)

        # Fall back to cookie-based authentication
        # This is used by web applications where tokens are stored in HTTP-only cookies
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            # No token found in cookies either, return None to allow other auth methods
            return None

        try:
            # Validate and decode the JWT token from the cookie
            # This checks the signature, expiration, and other token claims
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            # Token is invalid (expired, bad signature, etc.) - return None
            # This prevents authentication errors from breaking the request flow
            return None

        # Token is valid - authenticate the user and return the result
        # get_user() loads the user from the database using the token's user_id claim
        return self.get_user(validated_token), validated_token
