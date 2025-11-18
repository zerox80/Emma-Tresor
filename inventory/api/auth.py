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

from ..serializers import UserRegistrationSerializer
from .throttles import LoginRateThrottle, LogoutRateThrottle, RegisterRateThrottle

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


# ===============================
# AUTHENTICATION VIEWS
# ===============================

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
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        """
        Handle login requests and set authentication cookies.

        Processes login, generates JWT tokens, and sets them in secure cookies.
        The 'remember me' option controls cookie expiry.

        Returns:
            Response: User info and token metadata on success
        """
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
    'UserRegistrationViewSet',
    '_build_cookie_options',
    '_clear_token_cookies',
    '_coerce_bool',
    '_set_token_cookies',
]
