"""
Authentication and user-facing API views for the inventory backend.

Includes JWT-based login/logout, registration, CSRF helper, and token utilities.
"""

from __future__ import annotations

import logging
import random
import secrets
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from ..authentication import enforce_csrf
from ..serializers import UserRegistrationSerializer
from .throttles import LoginIPRateThrottle, LoginRateThrottle, LogoutRateThrottle, RegisterRateThrottle

User = get_user_model()


# ===============================
# AUTH COOKIE UTILITIES
# ===============================

from .auth_support import (
    _build_cookie_options,
    _clear_token_cookies,
    _coerce_bool,
    _set_token_cookies,
)
from .auth_tokens import CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login view with cookie-based JWT authentication.

    Features:
    - Sets JWT tokens in secure HTTP-only cookies
    - Supports 'remember me' functionality
    - Rate limiting for brute force protection
    - Returns user information on successful login
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle, LoginIPRateThrottle]

    def post(self, request, *args, **kwargs):
        """
        Handle login requests and set authentication cookies.

        Processes login, generates JWT tokens, and sets them in secure cookies.
        The 'remember me' option controls cookie expiry.

        Returns:
            Response: User info and token metadata on success
        """
        # Every response that installs authentication cookies must be bound to
        # a same-origin request.  Requiring CSRF here prevents login-CSRF / session
        # planting even though this endpoint itself is intentionally anonymous.
        enforce_csrf(request)

        # Extract 'remember me' preference from various possible field names
        remember_preference = (
            request.data.get('remember')
            or request.data.get('remember_me')
            or request.data.get('rememberMe')
        )
        remember_cookie = request.COOKIES.get(settings.JWT_REMEMBER_COOKIE_NAME)
        remember = _coerce_bool(remember_preference or remember_cookie)

        # Call parent to perform authentication
        response = super().post(request, *args, **kwargs)

        # If login successful, set cookies and modify response
        if response.status_code == status.HTTP_200_OK:
            data = dict(response.data)
            access = data.get('access')
            refresh = data.get('refresh')
            user_payload = data.get('user')

            # Set JWT tokens in HTTP-only cookies
            _set_token_cookies(
                response,
                access_token=access,
                refresh_token=refresh,
                remember=remember,
            )

            # Return user info instead of raw tokens (tokens are in cookies)
            response.data = {
                'user': user_payload,
                'access_expires': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                'remember': remember,
            }
        else:
            # Clear any existing cookies on failed login
            _clear_token_cookies(response)

        return response


class CustomTokenRefreshView(TokenRefreshView):
    """
    Custom token refresh view with cookie support.

    Refreshes access tokens using refresh tokens from cookies.
    Supports token rotation (new refresh token on each refresh).
    """

    def post(self, request, *args, **kwargs):
        """
        Handle token refresh requests.

        Reads refresh token from cookie, validates it, and issues new tokens.

        Returns:
            Response: New token metadata with cookies set
        """
        # Refresh always rotates/installs authentication cookies, regardless of
        # whether the refresh token arrived in the body or an HttpOnly cookie.
        enforce_csrf(request)

        # Get refresh token from cookie
        refresh_cookie = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        remember_cookie = request.COOKIES.get(settings.JWT_REMEMBER_COOKIE_NAME)

        # Prepare data for serializer
        data = request.data.copy()
        if 'refresh' not in data and refresh_cookie:
            data['refresh'] = refresh_cookie

        # Extract remember preference
        remember = _coerce_bool(data.get('remember') or remember_cookie)

        # Validate refresh token
        serializer = self.get_serializer(data=data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            # Invalid or expired refresh token - clear cookies
            response = Response({'detail': 'Aktualisierungstoken ungültig.'}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_token_cookies(response)
            return response

        # Extract new tokens
        validated = serializer.validated_data
        access = validated.get('access')
        refresh = validated.get('refresh')  # New refresh token (if rotation enabled)

        # Create response
        response = Response({
            'access_expires': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            'rotated': bool(refresh),  # Whether refresh token was rotated
        })

        # Set new tokens in cookies
        _set_token_cookies(
            response,
            access_token=access,
            refresh_token=refresh or refresh_cookie,  # Use new token or keep old one
            remember=remember,
        )

        return response


class CurrentUserView(APIView):
    """
    API endpoint to get current authenticated user's information.

    Returns basic user details for the currently logged-in user.
    Used by frontend to verify authentication state.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """
        Get current user information.

        Returns:
            Response: User ID, username, and email
        """
        user = request.user
        return Response(
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            }
        )


class PublicConfigView(APIView):
    """Expose non-sensitive runtime feature flags to anonymous clients."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        return Response({'registration_enabled': settings.ALLOW_USER_REGISTRATION})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFTokenView(APIView):
    """
    API endpoint to obtain CSRF token cookie.

    Frontend calls this before making state-changing requests to get
    a valid CSRF token cookie.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        """
        Set CSRF cookie in response.

        Returns:
            Response: Simple confirmation message
        """
        return Response({'detail': 'CSRF cookie set'}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Logout endpoint with JWT token blacklisting.

    Features:
    - Blacklists refresh token to prevent reuse
    - Clears all authentication cookies
    - Validates token ownership before blacklisting
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request, *args, **kwargs):
        """
        Handle logout requests.

        Blacklists the refresh token and clears authentication cookies.

        Returns:
            Response: 204 No Content on success
        """
        # Get refresh token from request body or cookie
        refresh_token = (
            request.data.get('refresh')
            or request.data.get('refresh_token')
            or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        )

        # Blacklist refresh token if provided
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token_user_id = token.payload.get('user_id')

                # Verify token belongs to current user (security check)
                if str(token_user_id) != str(request.user.id):
                    return Response(
                        {'detail': 'Aktualisierungstoken gehört nicht zu deinem Konto.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                # Blacklist the token
                token.blacklist()
            except (TokenError, AttributeError):
                # Token invalid or blacklisting failed - continue anyway
                pass

        # Clear authentication cookies
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_token_cookies(response)
        return response


__all__ = [
    'CurrentUserView',
    'CustomTokenObtainPairSerializer',
    'CustomTokenObtainPairView',
    'CustomTokenRefreshView',
    'GetCSRFTokenView',
    'LogoutView',
    'PublicConfigView',
    'UserRegistrationViewSet',
    '_build_cookie_options',
    '_clear_token_cookies',
    '_coerce_bool',
    '_set_token_cookies',
]
