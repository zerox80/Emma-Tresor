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

def _coerce_bool(value):
    """
    Convert various input types to boolean values.

    Accepts boolean values, strings ('1', 'true', 'yes', 'on'), and returns
    False for all other values. Used for parsing 'remember me' checkboxes.

    Args:
        value: Input value to convert (bool, str, or other)

    Returns:
        bool: Converted boolean value
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


def _build_cookie_options(path: str):
    """
    Build standardized cookie options from Django settings.

    Creates a dictionary of cookie settings for secure, httponly, and samesite
    attributes based on the application configuration.

    Args:
        path: Cookie path (e.g., '/' or '/api/')

    Returns:
        dict: Cookie options dictionary ready for set_cookie()
    """
    options = {
        'httponly': settings.JWT_COOKIE_HTTPONLY,  # Prevent JavaScript access
        'secure': settings.JWT_COOKIE_SECURE,      # HTTPS only
        'samesite': settings.JWT_COOKIE_SAMESITE,  # CSRF protection
        'path': path,                              # Cookie path scope
    }
    # Add domain if configured (for multi-subdomain support)
    if settings.JWT_COOKIE_DOMAIN:
        options['domain'] = settings.JWT_COOKIE_DOMAIN
    return options


def _set_token_cookies(response, *, access_token: str, refresh_token: str | None, remember: bool):
    """
    Set JWT authentication cookies in HTTP response.

    Sets three cookies:
    1. Access token (short-lived, for API authentication)
    2. Refresh token (long-lived, for obtaining new access tokens)
    3. Remember preference (stores user's 'remember me' choice)

    Args:
        response: Django HTTP response object
        access_token: JWT access token string
        refresh_token: JWT refresh token string (optional)
        remember: Whether user chose 'remember me' (affects cookie expiry)
    """
    # Calculate cookie expiry times from JWT settings
    access_max_age = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()) if remember else None

    # Get cookie configuration for different paths
    access_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    refresh_options = _build_cookie_options(settings.JWT_REFRESH_COOKIE_PATH)

    # Set access token cookie (always set)
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=access_max_age,
        **access_options,
    )

    # Set refresh token cookie (only if provided)
    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=refresh_max_age,  # None means session cookie if not remembering
            **refresh_options,
        )

    # Set remember preference cookie (for future login attempts)
    remember_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    remember_max_age = refresh_max_age or access_max_age
    response.set_cookie(
        settings.JWT_REMEMBER_COOKIE_NAME,
        '1' if remember else '0',
        max_age=remember_max_age,
        **remember_options,
    )


def _clear_token_cookies(response):
    """
    Clear all JWT authentication cookies from HTTP response.

    Called during logout or when tokens become invalid.
    Removes access token, refresh token, and remember preference cookies.

    Args:
        response: Django HTTP response object
    """
    # Get cookie configuration to ensure proper path/domain for deletion
    access_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    refresh_options = _build_cookie_options(settings.JWT_REFRESH_COOKIE_PATH)

    # Extract path and domain for deletion
    access_path = access_options.get('path', '/')
    access_domain = access_options.get('domain')

    refresh_path = refresh_options.get('path', '/')
    refresh_domain = refresh_options.get('domain')

    # Delete all three cookies
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        path=access_path,
        domain=access_domain,
    )
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=refresh_path,
        domain=refresh_domain,
    )
    response.delete_cookie(
        settings.JWT_REMEMBER_COOKIE_NAME,
        path=access_path,
        domain=access_domain,
    )
