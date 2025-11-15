# EmmaTresor Inventory Views
# ===========================
# This module contains all REST API views and ViewSets for the EmmaTresor inventory management system.
#
# Features implemented:
# - JWT authentication with secure cookie-based tokens
# - User registration and login with timing attack prevention
# - CRUD operations for items, locations, tags, and lists
# - QR code generation for asset tracking
# - CSV export functionality for inventory items
# - Image/file upload and download with security validation
# - Change logging and audit trails
# - Rate limiting for all sensitive operations
# - User data isolation (multi-tenancy)
#
# Security measures:
# - Constant-time string comparison to prevent timing attacks
# - Rate limiting on all endpoints
# - User ownership validation on all operations
# - Secure file handling with content type validation
# - CSRF protection for state-changing operations
# - Comprehensive input validation

# Standard library imports
import csv                                        # CSV file generation for exports
import io                                         # In-memory file operations
import mimetypes                                  # MIME type detection for file downloads
import os                                         # Operating system path operations
from urllib.parse import quote                    # URL encoding for filenames
from uuid import UUID                             # UUID validation and handling

# Django core imports
from django.conf import settings                  # Application settings access
from django.contrib.auth import get_user_model    # Dynamic user model access
from django.http import FileResponse, Http404, HttpResponse  # HTTP response types
from django.shortcuts import get_object_or_404    # Database query shortcut with 404 handling
from django.utils import timezone                 # Timezone-aware datetime handling
from django.utils.decorators import method_decorator  # Apply decorators to class methods
from django.utils.text import slugify             # Convert text to URL-safe slugs
from django.views.decorators.csrf import ensure_csrf_cookie  # CSRF cookie decorator

# Django REST Framework imports
from rest_framework import filters, mixins, permissions, serializers, status, throttling, viewsets
from rest_framework.decorators import action      # Custom ViewSet action decorator
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied  # REST exceptions
from rest_framework.pagination import PageNumberPagination  # Pagination support
from rest_framework.response import Response      # JSON response wrapper
from rest_framework.views import APIView          # Base API view class

# JWT authentication imports
from rest_framework_simplejwt.exceptions import TokenError  # JWT token errors
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # JWT serializer
from rest_framework_simplejwt.tokens import RefreshToken  # JWT refresh token handling
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView  # JWT views

# Third-party imports
from django_filters import rest_framework as django_filters  # Advanced filtering support

# Local application imports
from .models import Item, ItemImage, ItemChangeLog, ItemList, Location, Tag
from .serializers import (
    ItemChangeLogSerializer,
    ItemImageSerializer,
    ItemListSerializer,
    ItemSerializer,
    LocationSerializer,
    TagSerializer,
    UserRegistrationSerializer,
)

# Get the configured user model (allows custom user models)
User = get_user_model()

# ===============================
# UTILITY FUNCTIONS
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
        'path': path,                               # Cookie path scope
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
# CSV EXPORT UTILITIES
# ===============================

# CSV column headers for inventory item exports (German language)
ITEM_EXPORT_HEADERS = [
    'ID',                # Database primary key
    'Name',              # Item name
    'Beschreibung',      # Description
    'Anzahl',            # Quantity
    'Standort',          # Location
    'Tags',              # Category tags
    'Listen',            # Item lists
    'Inventarnummer',    # External inventory number
    'Kaufdatum',         # Purchase date
    'Wert (EUR)',        # Monetary value in EUR
    'Asset-Tag',         # UUID asset tag (for QR codes)
    'Erstellt am',       # Creation timestamp
    'Aktualisiert am',   # Last update timestamp
]

def _format_decimal(value):
    """
    Format decimal numbers for CSV export with German formatting.

    Args:
        value: Decimal value or None

    Returns:
        str: Formatted decimal string or empty string if None
    """
    if value is None:
        return ''
    return format(value, '.2f')  # Two decimal places

def _format_date(value):
    """
    Format date values for CSV export in ISO format (YYYY-MM-DD).

    Args:
        value: Date object or None

    Returns:
        str: ISO formatted date string or empty string if None
    """
    if value is None:
        return ''
    return value.isoformat()

def _format_datetime(value):
    """
    Format datetime values for CSV export in local timezone.

    Converts UTC timestamps to local timezone (Europe/Berlin by default)
    and formats as YYYY-MM-DD HH:MM:SS.

    Args:
        value: Datetime object or None

    Returns:
        str: Formatted datetime string or empty string if None
    """
    if value is None:
        return ''
    # Ensure timezone awareness
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_default_timezone())
    # Convert to local timezone
    localized = timezone.localtime(value)
    return localized.strftime('%Y-%m-%d %H:%M:%S')

def _prepare_items_csv_response(filename_prefix):
    """
    Prepare HTTP response for CSV export with German settings.

    Creates a CSV response with:
    - UTF-8 encoding with BOM (for Excel compatibility)
    - Semicolon delimiter (German CSV standard)
    - Timestamped filename
    - Minimal quoting for cleaner output

    Args:
        filename_prefix: Prefix for the CSV filename

    Returns:
        tuple: (HttpResponse object, csv.writer object)
    """
    # Generate timestamp for unique filename
    timestamp = timezone.localtime().strftime('%Y%m%d-%H%M%S')

    # Create CSV response with UTF-8 encoding
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename_prefix}-{timestamp}.csv"'

    # Write UTF-8 BOM (Byte Order Mark) for Excel compatibility
    response.write('\ufeff')

    # Create CSV writer with German settings (semicolon delimiter)
    writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_MINIMAL)

    # Write header row
    writer.writerow(ITEM_EXPORT_HEADERS)

    return response, writer

def _write_items_to_csv(writer, items):
    """
    Write inventory items to CSV writer.

    Formats each item's data and writes it as a CSV row with proper
    formatting for dates, decimals, and multi-value fields.

    Args:
        writer: csv.writer object
        items: QuerySet or iterable of Item objects
    """
    for item in items:
        # Format related many-to-many fields as comma-separated lists
        tags = ', '.join(sorted(tag.name for tag in item.tags.all()))
        lists = ', '.join(sorted(item_list.name for item_list in item.lists.all()))
        location = item.location.name if item.location else ''

        # Write row with formatted values
        writer.writerow([
            item.id,                                    # ID
            item.name,                                  # Name
            item.description or '',                     # Description
            item.quantity,                              # Quantity
            location,                                   # Location
            tags,                                       # Tags
            lists,                                      # Lists
            item.wodis_inventory_number or '',          # Inventory number
            _format_date(item.purchase_date),           # Purchase date
            _format_decimal(item.value),                # Value
            str(item.asset_tag),                        # Asset tag UUID
            _format_datetime(item.created_at),          # Created timestamp
            _format_datetime(item.updated_at),          # Updated timestamp
        ])

# ===============================
# RATE LIMITING THROTTLE CLASSES
# ===============================
# These classes implement rate limiting to prevent abuse and DoS attacks.
# Each throttle class corresponds to a specific operation and has its own limit.

class LoginRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for login attempts - prevents brute force attacks."""
    scope = 'login'

class RegisterRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for user registration - prevents spam account creation."""
    scope = 'register'

class LogoutRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for logout operations - prevents logout spam."""
    scope = 'logout'

class ItemCreateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for creating new items - prevents inventory spam."""
    scope = 'item_create'

class ItemUpdateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for updating items - prevents excessive updates."""
    scope = 'item_update'

class ItemDeleteRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for deleting items - prevents accidental mass deletion."""
    scope = 'item_delete'

class QRGenerateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for QR code generation - prevents resource exhaustion."""
    scope = 'qr_generate'

class ItemImageDownloadRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for image downloads - prevents bandwidth abuse."""
    scope = 'image_download'

class ItemReadRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for reading items - prevents excessive API calls."""
    scope = 'item_read'

class ItemExportRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for CSV exports - prevents resource exhaustion."""
    scope = 'item_export'

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
        import logging
        import time
        import secrets
        import random
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
        remember = _coerce_bool(remember_preference)

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

# ===============================
# BASE VIEWSET CLASSES
# ===============================

class UserScopedModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that implements user-scoped data isolation.

    Ensures users can only access and modify their own data.
    All queries are automatically filtered by user ownership.

    Subclasses must set:
    - owner_field: Name of the foreign key field pointing to user (default: 'user')
    """
    owner_field = 'user'  # Field name that references the user
    pagination_class = None  # Disable pagination by default

    def get_queryset(self):
        """
        Filter queryset to only include current user's data.

        Returns:
            QuerySet: Filtered queryset containing only user's owned objects
        """
        queryset = super().get_queryset()
        user = self.request.user

        # Return empty queryset for unauthenticated users
        if not user.is_authenticated:
            return queryset.none()

        # Filter by user ownership
        filter_kwargs = {f'{self.owner_field}__id': user.id}
        return queryset.filter(**filter_kwargs)

    def perform_create(self, serializer):
        """
        Automatically set owner when creating new objects.

        Args:
            serializer: Validated serializer instance
        """
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """
        Verify ownership before allowing updates.

        Args:
            serializer: Validated serializer instance

        Raises:
            PermissionDenied: If object doesn't belong to current user
        """
        instance = serializer.instance

        # Handle edge case where instance is None
        if instance is None:
            serializer.save(user=self.request.user)
            return

        # Verify ownership
        owner_value = getattr(instance, self.owner_field)
        if owner_value != self.request.user:
            raise PermissionDenied('Diese Ressource gehört nicht zu deinem Konto.')

        serializer.save()

# ===============================
# SIMPLE CRUD VIEWSETS
# ===============================

class TagViewSet(UserScopedModelViewSet):
    """
    ViewSet for managing user tags.

    Provides CRUD operations for tags with automatic user scoping.
    Each user can only see and manage their own tags.
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer

class LocationViewSet(UserScopedModelViewSet):
    """
    ViewSet for managing storage locations.

    Provides CRUD operations for locations with automatic user scoping.
    Each user can only see and manage their own locations.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

# ===============================
# FILTERING SUPPORT
# ===============================

class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """
    Custom filter for filtering by multiple numeric IDs.

    Allows filtering by comma-separated list of IDs, e.g.:
    /api/items/?tags=1,2,3
    """
    pass

class ItemFilter(django_filters.FilterSet):
    """
    Filter set for inventory items.

    Supports filtering by:
    - tags: One or more tag IDs (comma-separated)
    - location: One or more location IDs (comma-separated)
    """
    tags = NumberInFilter(field_name='tags__id')
    location = NumberInFilter(field_name='location__id')

    class Meta:
        """FilterSet metadata."""
        model = Item
        fields: list[str] = []  # No additional fields beyond custom filters

class ItemPagination(PageNumberPagination):
    """
    Pagination configuration for inventory items.

    Default: 20 items per page
    Configurable via ?page_size=X query parameter (max 100)
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

# ===============================
# INVENTORY ITEM VIEWSET
# ===============================

class ItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing inventory items.

    Features:
    - Full CRUD operations for items
    - Advanced filtering by tags, location, and text search
    - Sorting by name, quantity, value, purchase_date
    - Pagination (20 items per page)
    - CSV export of filtered items
    - QR code generation for individual items
    - Asset tag lookup for QR code scanning
    - Change log viewing
    - Per-action rate limiting

    Security:
    - User-scoped data (users only see their own items)
    - Ownership verification on all operations
    - Rate limiting on all actions
    """
    serializer_class = ItemSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ItemFilter
    search_fields = ['name', 'description', 'location__name', 'tags__name', 'wodis_inventory_number']
    ordering_fields = ['name', 'quantity', 'value', 'purchase_date']
    ordering = ['-purchase_date', 'name']  # Default ordering
    pagination_class = ItemPagination

    def get_queryset(self):
        """
        Get items owned by current user with optimized queries.

        Uses select_related and prefetch_related for performance optimization.

        Returns:
            QuerySet: User's items with related data preloaded
        """
        user = self.request.user
        if not user.is_authenticated:
            return Item.objects.none()

        # Optimize query with related data
        return (
            Item.objects.filter(owner=user)
            .select_related('location', 'owner')  # Avoid N+1 queries
            .prefetch_related('tags', 'images', 'lists')  # Preload many-to-many
            .distinct()
        )

    def get_throttles(self):
        """
        Apply different rate limits based on action.

        Each operation has its own throttle class with specific limits.

        Returns:
            list: Throttle instances for current action
        """
        throttles = []

        # Include base throttles
        base_throttles = super().get_throttles()
        if base_throttles:
            throttles.extend(base_throttles)

        # Add action-specific throttles
        if self.action == 'create':
            throttles.append(ItemCreateRateThrottle())
        elif self.action in ['update', 'partial_update']:
            throttles.append(ItemUpdateRateThrottle())
        elif self.action == 'destroy':
            throttles.append(ItemDeleteRateThrottle())
        elif self.action == 'generate_qr_code':
            throttles.append(QRGenerateRateThrottle())
        elif self.action in ['list', 'retrieve']:
            throttles.append(ItemReadRateThrottle())
        elif self.action == 'export_items':
            throttles.append(ItemExportRateThrottle())

        return throttles

    @action(detail=False, methods=['get'], url_path='export')
    def export_items(self, request):
        """
        Export filtered items to CSV.

        Exports all items matching current filters to a CSV file.
        Uses German CSV format (semicolon delimiter, UTF-8 with BOM).

        Returns:
            HttpResponse: CSV file with timestamped filename
        """
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Apply current filters to queryset
        queryset = self.filter_queryset(self.get_queryset())

        # Generate CSV response
        response, writer = _prepare_items_csv_response('emmatresor-inventar')
        _write_items_to_csv(writer, queryset)
        return response

    def perform_create(self, serializer):
        """
        Set owner when creating new items.

        Args:
            serializer: Validated item serializer
        """
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        """
        Verify ownership before updating items.

        Args:
            serializer: Validated item serializer

        Raises:
            PermissionDenied: If item doesn't belong to current user
        """
        instance = self.get_object()
        if instance.owner != self.request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')
        serializer.save(owner=instance.owner)

    @action(detail=False, methods=['get'], url_path='lookup_by_tag/(?P<asset_tag>[^/]+)')
    def lookup_by_asset_tag(self, request, asset_tag=None):
        """
        Look up item by asset tag (for QR code scanning).

        Endpoint: GET /api/items/lookup_by_tag/{uuid}/

        Args:
            asset_tag: UUID string from QR code

        Returns:
            Response: Item details if found and owned by user

        Raises:
            400: Invalid UUID format
            404: Item not found or doesn't belong to user
        """
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Validate and parse UUID
        try:
            cleaned_tag = str(asset_tag).strip() if asset_tag else ''
            if not cleaned_tag:
                return Response({'detail': 'QR-Code ist erforderlich.'}, status=status.HTTP_400_BAD_REQUEST)
            asset_uuid = UUID(cleaned_tag)
        except (TypeError, ValueError, AttributeError):
            return Response({'detail': 'Ungültiger QR-Code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up item by UUID and owner
        try:
            item = Item.objects.get(owner=user, asset_tag=asset_uuid)
        except Item.DoesNotExist:
            return Response({'detail': 'Gegenstand nicht gefunden.'}, status=status.HTTP_404_NOT_FOUND)

        # Serialize and return item
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='generate_qr_code')
    def generate_qr_code(self, request, pk=None):
        """
        Generate QR code image for item.

        Generates a QR code containing a URL that points to the item in the frontend.
        Can be displayed inline or downloaded as PNG.

        Query parameters:
        - download: Set to '1', 'true', or 'yes' to force download

        Returns:
            HttpResponse: PNG image with QR code

        Raises:
            503: If qrcode library not installed
            403: If item doesn't belong to user
        """
        # Check if qrcode library is available
        try:
            import qrcode
        except ImportError:
            return Response(
                {'detail': 'QR-Code-Generierung ist nicht verfügbar. Bitte installiere qrcode[pil].'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Get item and verify ownership
        item = self.get_object()
        if item.owner != request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')

        # Generate QR code with frontend scan URL
        qr = qrcode.QRCode(version=1, box_size=5, border=4)
        scan_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/scan/{item.asset_tag}"
        qr.add_data(scan_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')

        # Determine disposition (inline vs attachment)
        download = request.query_params.get('download', '')
        as_attachment = str(download).lower() in {'1', 'true', 'yes', 'download'}
        disposition = 'attachment' if as_attachment else 'inline'

        # Generate PNG response
        with io.BytesIO() as buffer:
            img.save(buffer, format='PNG')
            buffer.seek(0)
            response = HttpResponse(buffer.getvalue(), content_type='image/png')
        response['Content-Disposition'] = f'{disposition}; filename="item-{item.id}-qr.png"'
        return response

    @action(detail=True, methods=['get'], url_path='changelog')
    def changelog(self, request, pk=None):
        """
        Get change log for item.

        Returns all change log entries for the item, ordered by most recent first.

        Returns:
            Response: List of change log entries

        Raises:
            403: If item doesn't belong to user
        """
        # Get item and verify ownership
        item = self.get_object()
        if item.owner != request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')

        # Get change logs with user information
        logs = ItemChangeLog.objects.filter(item=item).select_related('user').order_by('-created_at')
        serializer = ItemChangeLogSerializer(logs, many=True)
        return Response(serializer.data)

# ===============================
# IMAGE MANAGEMENT VIEWSETS
# ===============================

class ItemImageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing item images and attachments.

    Features:
    - Upload images/PDFs for items
    - Update/delete attachments
    - Automatic ownership validation
    - Security validation (file type, size, content)

    Note: Actual file downloads are handled by ItemImageDownloadView
    """
    serializer_class = ItemImageSerializer
    pagination_class = None

    def get_queryset(self):
        """
        Get images for items owned by current user.

        Returns:
            QuerySet: User's item images with related data
        """
        user = self.request.user
        if not user.is_authenticated:
            return ItemImage.objects.none()
        return ItemImage.objects.filter(item__owner=user).select_related('item', 'item__owner')

    def perform_create(self, serializer):
        """
        Verify item ownership before adding images.

        Args:
            serializer: Validated image serializer

        Raises:
            PermissionDenied: If item doesn't belong to user
        """
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände hinzugefügt werden.')
        serializer.save()

    def perform_update(self, serializer):
        """
        Verify item ownership before updating images.

        Args:
            serializer: Validated image serializer

        Raises:
            PermissionDenied: If item doesn't belong to user
        """
        item = serializer.validated_data.get('item', serializer.instance.item)
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände bearbeitet werden.')
        serializer.save()

class ItemImageDownloadView(APIView):
    """
    Secure file download endpoint for item images and attachments.

    Features:
    - Ownership verification before download
    - Content type validation
    - Proper HTTP headers for downloads
    - Support for inline display or attachment download
    - UTF-8 filename support
    - Rate limiting

    Security:
    - Only authenticated users can download
    - Users can only download files for their own items
    - Content type whitelist
    - No caching for privacy
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ItemImageDownloadRateThrottle]

    def get(self, request, pk: int, *args, **kwargs):
        """
        Download item image or attachment.

        Query parameters:
        - disposition: 'inline' to display in browser (default for images),
                      'attachment' to force download

        Args:
            pk: ItemImage primary key

        Returns:
            FileResponse: File with appropriate headers

        Raises:
            404: File not found or doesn't belong to user
        """
        # Get attachment with ownership check
        attachment = get_object_or_404(
            ItemImage.objects.select_related('item__owner'),
            pk=pk,
            item__owner=request.user,
        )

        # Verify file exists
        if not attachment.image:
            raise Http404('Datei nicht gefunden.')

        # Open file
        try:
            file_handle = attachment.image.open('rb')
        except FileNotFoundError as exc:
            raise Http404('Datei nicht verfügbar.') from exc

        # Extract filename
        filename = os.path.basename(attachment.image.name)
        if not filename:
            filename = f"attachment-{attachment.pk}"

        # Create ASCII-safe filename for old clients
        ascii_filename = filename.encode('ascii', 'ignore').decode('ascii') or filename

        # Whitelist of allowed content types
        ALLOWED_CONTENT_TYPES = {
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/avif', 'image/heic', 'image/heif',
            'application/pdf',
        }

        # Determine content type
        guessed_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        # Validate content type
        if guessed_type not in ALLOWED_CONTENT_TYPES:
            # Force generic binary type for unknown files
            content_type = 'application/octet-stream'
        else:
            content_type = guessed_type

        # Determine disposition
        disposition_param = request.query_params.get('disposition', '').lower()

        if content_type == 'application/pdf':
            # Always download PDFs for security
            disposition = 'attachment'
        else:
            # Images can be inline or downloaded
            disposition = 'inline' if disposition_param == 'inline' else 'attachment'

        # Create response
        response = FileResponse(file_handle, content_type=content_type)

        # Set filename with UTF-8 support (RFC 5987)
        filename_utf8 = quote(filename)
        response['Content-Disposition'] = (
            f"{disposition}; filename=\"{ascii_filename}\"; "
            f"filename*=UTF-8''{filename_utf8}"
        )

        # Disable caching for privacy
        response['Cache-Control'] = 'private, max-age=0, no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'

        # Set content length if available
        try:
            response['Content-Length'] = str(attachment.image.size)
        except (OSError, ValueError):
            pass

        return response

# ===============================
# ITEM LIST MANAGEMENT
# ===============================

class ItemListViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing item lists.

    Features:
    - Create custom lists of items
    - Add/remove items from lists
    - Export list contents to CSV
    - User-scoped (each user has their own lists)
    """
    serializer_class = ItemListSerializer
    pagination_class = None

    def get_queryset(self):
        """
        Get lists owned by current user.

        Returns:
            QuerySet: User's item lists with items preloaded
        """
        user = self.request.user
        if not user.is_authenticated:
            return ItemList.objects.none()
        return ItemList.objects.filter(owner=user).prefetch_related('items', 'owner')

    def perform_create(self, serializer):
        """
        Set owner when creating new lists.

        Args:
            serializer: Validated list serializer
        """
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        """
        Verify ownership before updating lists.

        Args:
            serializer: Validated list serializer

        Raises:
            PermissionDenied: If list doesn't belong to user
        """
        instance = serializer.instance
        if instance.owner != self.request.user:
            raise PermissionDenied('Diese Inventarliste gehört nicht zu deinem Konto.')
        serializer.save()

    @action(detail=True, methods=['get'], url_path='export')
    def export_items(self, request, pk=None):
        """
        Export list items to CSV.

        Exports all items in the list to a CSV file with list-specific filename.

        Returns:
            HttpResponse: CSV file with list items

        Raises:
            403: If list doesn't belong to user
        """
        # Get list and verify ownership
        item_list = self.get_object()
        if item_list.owner != request.user:
            raise PermissionDenied('Diese Inventarliste gehört nicht zu deinem Konto.')

        # Get items in list with related data
        items = (
            item_list.items.select_related('location', 'owner')
            .prefetch_related('tags', 'lists')
            .order_by('name', 'id')
        )

        # Generate filename from list name
        list_slug = slugify(item_list.name) or 'liste'
        filename_prefix = f'emmatresor-liste-{item_list.id}-{list_slug}'

        # Generate CSV response
        response, writer = _prepare_items_csv_response(filename_prefix)
        _write_items_to_csv(writer, items)
        return response
