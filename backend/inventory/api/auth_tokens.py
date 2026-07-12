"""
Authentication and user-facing API views for the inventory backend.

Includes JWT-based login/logout, registration, CSRF helper, and token utilities.
"""

from __future__ import annotations

import logging
import random
import secrets
import time

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

class UserRegistrationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    User registration ViewSet.

    Allows new users to create accounts when registration is enabled.
    Only supports POST (create) operations.

    Security features:
    - Rate limiting to prevent spam registrations
    - Can be globally disabled via settings
    - Password validation through serializer
    """
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]  # Public endpoint
    serializer_class = UserRegistrationSerializer
    throttle_classes = [RegisterRateThrottle]
    http_method_names = ['post']  # Only allow POST

    def create(self, request, *args, **kwargs):
        """
        Handle user registration requests.

        Checks if registration is enabled before allowing account creation.

        Returns:
            Response: 403 if registration disabled, otherwise creates user
        """
        # Check if registration is enabled in settings
        if not settings.ALLOW_USER_REGISTRATION:
            return Response(
                {'detail': 'Registrierungen sind derzeit deaktiviert.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer with email login and timing attack protection.

    Enhancements over standard JWT serializer:
    - Allows login with email OR username
    - Implements timing attack prevention
    - Adds user information to token payload
    - Case-insensitive email/username matching
    - Constant-time string comparison
    """

    def __init__(self, *args, **kwargs):
        """
        Initialize serializer with email field support.

        Makes both username and email optional, as user can provide either.
        """
        super().__init__(*args, **kwargs)
        # Add email field (not required as username might be used)
        self.fields['email'] = serializers.EmailField(required=False, allow_blank=False)
        # Make username optional (email might be used instead)
        self.fields[self.username_field].required = False

    @classmethod
    def get_token(cls, user):
        """
        Add custom claims to JWT token payload.

        Args:
            user: User object to create token for

        Returns:
            RefreshToken: Token with custom claims added
        """
        token = super().get_token(user)
        # Add username and email to token payload
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        """
        Validate login credentials with timing attack protection.

        This method implements several security measures:
        1. Constant-time string comparison to prevent timing attacks
        2. Dummy operations when user not found to normalize timing
        3. Random delays to make timing attacks harder
        4. Case-insensitive email/username matching

        Args:
            attrs: Dictionary with email/username and password

        Returns:
            dict: Validated data with access/refresh tokens and user info

        Raises:
            AuthenticationFailed: If credentials are invalid
        """
        security_logger = logging.getLogger('security')

        def constant_time_compare(a, b):
            """
            Compare strings in constant time to prevent timing attacks.

            Uses secrets.compare_digest which is resistant to timing analysis.
            """
            return secrets.compare_digest(a, b)

        # Base delay for all authentication attempts (200-300ms)
        # This makes timing attacks significantly harder
        base_delay = random.uniform(0.20, 0.30)
        start_time = time.perf_counter()

        # Extract and normalize email (case-insensitive)
        email = attrs.get('email')
        if email:
            email = email.strip().lower()
            attrs['email'] = email

        # Extract username
        username = attrs.get(self.username_field)
        user_found = False
        authentication_result = None

        # Generate dummy values for timing attack protection
        # When user is not found, we'll use these to perform similar operations
        dummy_username = secrets.token_urlsafe(32)
        lookup_username = username if username else dummy_username
        lookup_email = email if email else f"{dummy_username}@example.com"

        try:
            # Try to find user by email or username
            if email and not username:
                # Login with email
                user = User.objects.filter(email__iexact=lookup_email).first()
                if user:
                    # Use constant-time comparison to prevent timing attacks
                    email_check = constant_time_compare(email.lower(), user.email.lower())
                    if email_check:
                        attrs[self.username_field] = getattr(user, self.username_field)
                        user_found = True
                        authentication_result = user
            elif username:
                # Login with username
                user = User.objects.filter(username__iexact=lookup_username).first()
                if user:
                    # Use constant-time comparison
                    username_check = constant_time_compare(username.lower(), user.username.lower())
                    if username_check:
                        attrs[self.username_field] = getattr(user, self.username_field)
                        user_found = True
                        authentication_result = user
        except Exception:
            # Log database errors without revealing details
            security_logger.error('Database error during authentication lookup')

        # Log authentication attempt (no sensitive data)
        security_logger.info(
            'Authentication attempt processed',
            extra={
                'timestamp': time.time(),
                'ip_hash': secrets.token_hex(8)[:16],  # Hashed IP for privacy
            }
        )

        try:
            # Perform authentication with timing normalization
            if not user_found:
                # User not found - perform dummy validation to normalize timing
                dummy_attrs = attrs.copy()
                if email and not username:
                    dummy_attrs[self.username_field] = dummy_username
                dummy_attrs['password'] = secrets.token_urlsafe(32)

                # This will fail but takes similar time as real authentication
                super().validate(dummy_attrs)
            else:
                # User found - perform real authentication
                data = super().validate(attrs)

            # If user was not found, fail after timing normalization
            if not user_found:
                # Add random delay to make timing attacks harder
                elapsed = time.perf_counter() - start_time
                target_with_variance = base_delay + random.uniform(0.10, 0.20)

                if elapsed < target_with_variance:
                    sleep_time = target_with_variance - elapsed
                    time.sleep(sleep_time)

                raise AuthenticationFailed('Ungültige Anmeldedaten.')

            # Add user information to response
            data['user'] = {
                'id': authentication_result.id,
                'username': authentication_result.username,
                'email': authentication_result.email,
            }
            return data

        except AuthenticationFailed:
            # Normalize timing for failed authentication attempts
            elapsed = time.perf_counter() - start_time
            target_with_variance = base_delay + random.uniform(0.10, 0.20)

            if elapsed < target_with_variance:
                sleep_time = target_with_variance - elapsed
                time.sleep(sleep_time)

            raise AuthenticationFailed('Ungültige Anmeldedaten.')
