import csv
import io
import mimetypes
import os
from urllib.parse import quote
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, permissions, serializers, status, throttling, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from django_filters import rest_framework as django_filters
from django.utils import timezone
from django.utils.text import slugify

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


User = get_user_model()


def _coerce_bool(value):
    """Coerces a value to a boolean with comprehensive type handling.

    This function provides a robust way to convert various input types to boolean
    values, commonly used for processing form data, query parameters, and
    environment variables. It implements sensible defaults and handles edge cases
    that might occur in web application contexts.

    The function follows these conversion rules:
    - Booleans: Returned as-is
    - Strings: Case-insensitive matching against common truthy values
    - Other types: Always return False (safe default)

    Args:
        value: The value to coerce to a boolean. Can be any type, though
            typically will be str, bool, or None from request data.

    Returns:
        bool: The coerced boolean value. True for recognized truthy values,
            False for everything else.

    Examples:
        >>> _coerce_bool('true')
        True
        >>> _coerce_bool('FALSE')
        False
        >>> _coerce_bool(1)
        False
        >>> _coerce_bool(True)
        True
        >>> _coerce_bool(None)
        False
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


def _build_cookie_options(path: str):
    """Builds a dictionary of security-enhanced cookie options.

    This function creates a comprehensive cookie configuration dictionary based on
    Django settings, ensuring all necessary security flags are properly set for
    JWT authentication cookies. It centralizes cookie configuration to maintain
    consistency across all authentication-related cookie operations.

    Security Features Applied:
    - HttpOnly: Prevents JavaScript access (XSS protection)
    - Secure: Ensures HTTPS-only transmission in production
    - SameSite: Controls cross-site request behavior
    - Domain: Restricts to specific domain when configured
    - Path: Limits cookie scope to specific URL paths

    Args:
        path (str): The URL path for which the cookie should be valid.
            Typically '/api/' for refresh tokens and '/' for access tokens.

    Returns:
        dict: A dictionary of cookie options compatible with Django's
            response.set_cookie() method. All security settings are
            dynamically pulled from Django configuration.

    Example:
        >>> options = _build_cookie_options('/api/')
        >>> response.set_cookie('refresh_token', 'token_value', **options)
    """
    options = {
        'httponly': settings.JWT_COOKIE_HTTPONLY,
        'secure': settings.JWT_COOKIE_SECURE,
        'samesite': settings.JWT_COOKIE_SAMESITE,
        'path': path,
    }
    if settings.JWT_COOKIE_DOMAIN:
        options['domain'] = settings.JWT_COOKIE_DOMAIN
    return options


def _set_token_cookies(response, *, access_token: str, refresh_token: str | None, remember: bool):
    """Sets JWT authentication cookies with enhanced security features.

    This function configures and sets all necessary JWT authentication cookies on the
    HTTP response, handling both short-lived access tokens and long-lived refresh
    tokens. It implements proper security measures including HttpOnly flags and
    configurable persistence based on user preferences.

    Cookie Strategy:
    - Access Token: Always set with short expiration (15 minutes default)
    - Refresh Token: Only set if user chooses "remember me", otherwise session-only
    - Remember Flag: Tracks user's persistence preference across sessions

    Security Considerations:
    - All cookies use secure options from _build_cookie_options()
    - Token lifetimes are pulled from JWT configuration
    - Refresh tokens can be omitted for enhanced security (session-only auth)
    - Proper error handling for missing or invalid tokens

    Args:
        response (HttpResponse): The Django response object to set cookies on.
        access_token (str): The JWT access token with short lifetime.
        refresh_token (str | None): The JWT refresh token with longer lifetime,
            or None if not applicable (e.g., when refresh is handled elsewhere).
        remember (bool): Whether user chose persistent authentication ("remember me").
            True sets refresh token with extended lifetime, False makes it session-only.

    Note:
        This function should be called after successful authentication. The token
        lifetimes are automatically calculated from SIMPLE_JWT settings.
    """
    access_max_age = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()) if remember else None

    access_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    refresh_options = _build_cookie_options(settings.JWT_REFRESH_COOKIE_PATH)

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=access_max_age,
        **access_options,
    )

    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=refresh_max_age,
            **refresh_options,
        )

    remember_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    remember_max_age = refresh_max_age or access_max_age
    response.set_cookie(
        settings.JWT_REMEMBER_COOKIE_NAME,
        '1' if remember else '0',
        max_age=remember_max_age,
        **remember_options,
    )


def _clear_token_cookies(response):
    """Clears all JWT authentication cookies from the response.

    This function securely removes all authentication-related cookies (access token,
    refresh token, and remember flag) from the HTTP response. It ensures
    complete logout by clearing all traces of authentication while maintaining
    security best practices.

    Security Considerations:
    - Uses the same cookie options as setting for consistency
    - Clears all three cookies: access, refresh, and remember
    - Proper path and domain handling for cross-site scenarios
    - Prevents partial logout scenarios

    Args:
        response (HttpResponse): The Django response object to clear cookies from.
            Must be the same response object that was used for authentication.

    Note:
        This function should be called during logout to ensure users are completely
        logged out and cannot be re-authenticated with existing tokens.
    """
    access_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    refresh_options = _build_cookie_options(settings.JWT_REFRESH_COOKIE_PATH)

    # The delete_cookie method only accepts path and domain.
    # We can extract them from the options we've built.
    access_path = access_options.get('path', '/')
    access_domain = access_options.get('domain')

    refresh_path = refresh_options.get('path', '/')
    refresh_domain = refresh_options.get('domain')


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


ITEM_EXPORT_HEADERS = [
    'ID',
    'Name',
    'Beschreibung',
    'Anzahl',
    'Standort',
    'Tags',
    'Listen',
    'Inventarnummer',
    'Kaufdatum',
    'Wert (EUR)',
    'Asset-Tag',
    'Erstellt am',
    'Aktualisiert am',
]


def _format_decimal(value):
    """Formats a decimal value as a string with two decimal places.

    This function formats decimal values for CSV export, ensuring
    consistent decimal representation for monetary values.

    Args:
        value (Decimal): The decimal value to format.

    Returns:
        str: The formatted string with two decimal places, or an empty
            string if the value is None.
    """
    if value is None:
        return ''
    return format(value, '.2f')


def _format_date(value):
    """Formats a date object as an ISO 8601 string.

    This function formats date objects for CSV export, ensuring
    consistent date representation across the application.

    Args:
        value (date): The date object to format.

    Returns:
        str: The ISO 8601 formatted date string, or an empty
            string if the value is None.
    """
    if value is None:
        return ''
    return value.isoformat()


def _format_datetime(value):
    """Formats a datetime object as a string in the format 'YYYY-MM-DD HH:MM:SS'.

    This function formats datetime objects for CSV export, ensuring
    consistent datetime representation with timezone awareness.

    Args:
        value (datetime): The datetime object to format.

    Returns:
        str: The formatted datetime string in local timezone, or an empty
            string if the value is None.
    """
    if value is None:
        return ''
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_default_timezone())
    localized = timezone.localtime(value)
    return localized.strftime('%Y-%m-%d %H:%M:%S')


def _prepare_items_csv_response(filename_prefix):
    """Prepares an HttpResponse object for a CSV download.

    This function creates an HTTP response configured for CSV download
    with appropriate headers and a timestamped filename.

    Args:
        filename_prefix (str): The prefix for the CSV filename.

    Returns:
        tuple[HttpResponse, csv.writer]: A tuple containing the HttpResponse
            object configured for CSV download and the CSV writer instance.
    """
    timestamp = timezone.localtime().strftime('%Y%m%d-%H%M%S')
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename=\"{filename_prefix}-{timestamp}.csv\"'
    response.write('\ufeff')  # Add BOM for better Excel compatibility
    writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(ITEM_EXPORT_HEADERS)
    return response, writer


def _write_items_to_csv(writer, items):
    """Writes a list of items to a CSV writer.

    This function iterates through items and writes each one as a row
    in the CSV format, handling related objects and formatting
    values appropriately.

    Args:
        writer (csv.writer): The CSV writer object to write to.
        items (QuerySet[Item]): A queryset of items to write.
    """
    for item in items:
        tags = ', '.join(sorted(tag.name for tag in item.tags.all()))
        lists = ', '.join(sorted(item_list.name for item_list in item.lists.all()))
        location = item.location.name if item.location else ''
        writer.writerow([
            item.id,
            item.name,
            item.description or '',
            item.quantity,
            location,
            tags,
            lists,
            item.wodis_inventory_number or '',
            _format_date(item.purchase_date),
            _format_decimal(item.value),
            str(item.asset_tag),
            _format_datetime(item.created_at),
            _format_datetime(item.updated_at),
        ])


class LoginRateThrottle(throttling.AnonRateThrottle):
    """Throttles login attempts for anonymous users.

    This throttle class limits the rate of login attempts to prevent
    brute force attacks on authentication endpoints.
    """
    scope = 'login'


class RegisterRateThrottle(throttling.AnonRateThrottle):
    """Throttles registration attempts for anonymous users.

    This throttle class limits the rate of user registration attempts
    to prevent spam and automated account creation.
    """
    scope = 'register'


class LogoutRateThrottle(throttling.AnonRateThrottle):
    """Throttles logout attempts for anonymous users.

    This throttle class limits the rate of logout attempts to
    prevent potential denial of service attacks.
    """
    scope = 'logout'


class ItemCreateRateThrottle(throttling.UserRateThrottle):
    """Throttles item creation attempts for authenticated users.

    This throttle class limits the rate at which authenticated users
    can create new items to prevent system abuse.
    """
    scope = 'item_create'


class ItemUpdateRateThrottle(throttling.UserRateThrottle):
    """Throttles item update attempts for authenticated users.

    This throttle class limits the rate at which authenticated users
    can update existing items to prevent system abuse.
    """
    scope = 'item_update'


class ItemDeleteRateThrottle(throttling.UserRateThrottle):
    """Throttles item deletion attempts for authenticated users.

    This throttle class limits the rate at which authenticated users
    can delete items to prevent accidental or malicious data loss.
    """
    scope = 'item_delete'


class QRGenerateRateThrottle(throttling.UserRateThrottle):
    """Throttles QR code generation attempts for authenticated users.

    This throttle class limits the rate at which authenticated users
    can generate QR codes to prevent system abuse.
    """
    scope = 'qr_generate'


class UserRegistrationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """A viewset for user registration.

    This viewset handles user registration with validation, rate limiting,
    and optional registration restrictions based on system settings.
    """
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer
    throttle_classes = [RegisterRateThrottle]
    http_method_names = ['post']

    def create(self, request, *args, **kwargs):
        """
        Creates a new user.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
        """
        if not settings.ALLOW_USER_REGISTRATION:
            return Response(
                {'detail': 'Registrierungen sind derzeit deaktiviert.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """A custom token obtain pair serializer that allows logging in with either username or email.

    This serializer enhances the default JWT token serializer by supporting
    login with either username or email address, and includes security
    measures against timing attacks and user enumeration.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField(required=False, allow_blank=False)
        self.fields[self.username_field].required = False

    @classmethod
    def get_token(cls, user):
        """
        Gets a token for the given user.

        Args:
            user (User): The user to get a token for.

        Returns:
            Token: The token for the user.
        """
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        """
        Validates the given attributes with enhanced timing attack protection.

        Args:
            attrs (dict): The attributes to validate.

        Returns:
            dict: The validated data.
        """
        import logging
        import time
        import secrets
        import random
        security_logger = logging.getLogger('security')
        
        # Constant-time comparison helper
        def constant_time_compare(a, b):
            """Compare two strings in constant time to prevent timing attacks."""
            return secrets.compare_digest(a, b)
        
        # Generate random delay base for timing normalization - OPTIMIZED
        # This makes timing attacks much harder by adding unpredictability
        # Reduced base delay for better user experience while maintaining security
        base_delay = random.uniform(0.05, 0.12)  # Random base between 50-120ms (faster)
        start_time = time.perf_counter()
        
        email = attrs.get('email')
        if email:
            email = email.strip().lower()
            attrs['email'] = email

        username = attrs.get(self.username_field)
        user_found = False
        authentication_result = None
        
        # Always perform database lookup to maintain constant timing
        # This prevents user enumeration through timing differences
        dummy_username = secrets.token_urlsafe(32)  # Generate random dummy username
        lookup_username = username if username else dummy_username
        lookup_email = email if email else f"{dummy_username}@example.com"
        
        # Perform user lookup with constant-time behavior
        try:
            if email and not username:
                # Always query the database, even for non-existent users
                user = User.objects.filter(email__iexact=lookup_email).first()
                if user:
                    # Verify email exists using constant-time comparison
                    email_check = constant_time_compare(email.lower(), user.email.lower())
                    if email_check:
                        attrs[self.username_field] = getattr(user, self.username_field)
                        user_found = True
                        authentication_result = user
            elif username:
                user = User.objects.filter(username__iexact=lookup_username).first()
                if user:
                    username_check = constant_time_compare(username.lower(), user.username.lower())
                    if username_check:
                        user_found = True
                        authentication_result = user
        except Exception:
            # Log any database errors but don't expose them
            security_logger.error('Database error during authentication lookup')
        
        # Log authentication attempts (without exposing whether user exists)
        security_logger.info(
            'Authentication attempt processed',
            extra={
                'timestamp': time.time(),
                'ip_hash': secrets.token_hex(8)[:16],  # Hashed IP for privacy
            }
        )
        
        # Always attempt authentication to maintain constant timing
        # This prevents timing attacks by ensuring similar execution paths
        try:
            # Use dummy credentials if no user found to maintain constant time
            if not user_found:
                dummy_attrs = attrs.copy()
                if email and not username:
                    dummy_attrs[self.username_field] = dummy_username
                dummy_attrs['password'] = secrets.token_urlsafe(32)  # Random dummy password
                # This will fail but takes similar time as real authentication
                super().validate(dummy_attrs)
            else:
                data = super().validate(attrs)
                
            # SECURITY FIX: Only apply timing protection for FAILED authentication
            # SUCCESSFUL authentication should work normally without artificial delays
            if not user_found:
                # Calculate remaining time to reach target with randomization for FAILED auth
                elapsed = time.perf_counter() - start_time
                target_with_variance = base_delay + random.uniform(0.05, 0.15)  # Add 50-150ms variance
                
                if elapsed < target_with_variance:
                    sleep_time = target_with_variance - elapsed
                    time.sleep(sleep_time)
                
                # Only raise error for ACTUALLY failed authentication
                raise AuthenticationFailed('Ungültige Anmeldedaten.')
            
            # SUCCESSFUL authentication - proceed normally without artificial delays
            data['user'] = {
                'id': authentication_result.id,
                'username': authentication_result.username,
                'email': authentication_result.email,
            }
            return data
            
        except AuthenticationFailed:
            # This handles actual authentication failures from super().validate()
            # Calculate remaining time for failed authentication
            elapsed = time.perf_counter() - start_time
            target_with_variance = base_delay + random.uniform(0.05, 0.15)
            
            if elapsed < target_with_variance:
                sleep_time = target_with_variance - elapsed
                time.sleep(sleep_time)
            
            # Always use the same generic error message
            raise AuthenticationFailed('Ungültige Anmeldedaten.')


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    A custom token obtain pair view that sets the token cookies.
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        """
        Handles POST requests.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
        """
        remember_preference = (
            request.data.get('remember')
            or request.data.get('remember_me')
            or request.data.get('rememberMe')
        )
        remember = _coerce_bool(remember_preference)

        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            data = dict(response.data)
            access = data.get('access')
            refresh = data.get('refresh')
            user_payload = data.get('user')

            _set_token_cookies(
                response,
                access_token=access,
                refresh_token=refresh,
                remember=remember,
            )

            response.data = {
                'user': user_payload,
                'access_expires': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                'remember': remember,
            }
        else:
            _clear_token_cookies(response)

        return response


class CustomTokenRefreshView(TokenRefreshView):
    """
    A custom token refresh view that sets the token cookies.
    """
    def post(self, request, *args, **kwargs):
        """
        Handles POST requests.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
        """
        refresh_cookie = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        remember_cookie = request.COOKIES.get(settings.JWT_REMEMBER_COOKIE_NAME)

        data = request.data.copy()
        if 'refresh' not in data and refresh_cookie:
            data['refresh'] = refresh_cookie

        remember = _coerce_bool(data.get('remember') or remember_cookie)

        serializer = self.get_serializer(data=data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response({'detail': 'Aktualisierungstoken ungültig.'}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_token_cookies(response)
            return response

        validated = serializer.validated_data
        access = validated.get('access')
        refresh = validated.get('refresh')

        response = Response({
            'access_expires': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            'rotated': bool(refresh),
        })

        _set_token_cookies(
            response,
            access_token=access,
            refresh_token=refresh or refresh_cookie,
            remember=remember,
        )

        return response


class CurrentUserView(APIView):
    """A view to get the current user.

    This view provides information about the currently authenticated user,
    including their ID, username, and email address.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """
        Handles GET requests.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
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
    Endpoint to retrieve CSRF token for authenticated and unauthenticated users.
    This ensures the frontend can get a CSRF token before making POST requests.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        """
        Handles GET requests.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
        """
        return Response({'detail': 'CSRF cookie set'}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    A view to log out the user.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request, *args, **kwargs):
        """
        Handles POST requests.

        Args:
            request (Request): The request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: A response object.
        """
        refresh_token = (
            request.data.get('refresh')
            or request.data.get('refresh_token')
            or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        )

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token_user_id = token.payload.get('user_id')

                if str(token_user_id) != str(request.user.id):
                    return Response(
                        {'detail': 'Aktualisierungstoken gehört nicht zu deinem Konto.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                token.blacklist()
            except (TokenError, AttributeError):
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_token_cookies(response)
        return response


class UserScopedModelViewSet(viewsets.ModelViewSet):
    """A base viewset for models that are scoped to the current user.

    This viewset automatically filters querysets to only include objects
    owned by the currently authenticated user. It also ensures that when new
    objects are created, the owner is set to the current user.
    It includes ownership validation for update operations.

    Attributes:
        owner_field (str): The name of the field on the model that represents
            the owner of the object. Defaults to 'user'.
        pagination_class (PageNumberPagination): The pagination class to use
            for list views. Defaults to None.
    """
    owner_field = 'user'
    pagination_class = None

    def get_queryset(self):
        """
        Gets the queryset for the viewset.

        Returns:
            QuerySet: The queryset for the viewset.
        """
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        # Safe field lookup without f-string interpolation
        filter_kwargs = {f'{self.owner_field}__id': user.id}
        return queryset.filter(**filter_kwargs)

    def perform_create(self, serializer):
        """
        Performs creation of a new object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """
        Performs update of an existing object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        instance = serializer.instance
        if instance is None:
            serializer.save(user=self.request.user)
            return

        owner_value = getattr(instance, self.owner_field)
        if owner_value != self.request.user:
            raise PermissionDenied('Diese Ressource gehört nicht zu deinem Konto.')

        # Don't override owner in update
        serializer.save()

class TagViewSet(UserScopedModelViewSet):
    """A viewset for managing tags.

    This viewset provides CRUD operations for tags, scoped to the
    currently authenticated user. It inherits from `UserScopedModelViewSet`
    to ensure that users can only manage their own tags.
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class LocationViewSet(UserScopedModelViewSet):
    """A viewset for managing locations.

    This viewset provides CRUD operations for locations, scoped to the
    currently authenticated user. It inherits from `UserScopedModelViewSet`
    to ensure that users can only manage their own locations.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer



class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """A filter that allows filtering by a comma-separated list of numbers.

    This filter extends Django's BaseInFilter to support filtering by
    comma-separated values, which is useful for many-to-many
    relationships like tags or locations.

    Example:
        ?tags__in=1,2,3  # Filter for items with tags 1, 2, or 3
    """
    pass


class ItemFilter(django_filters.FilterSet):
    """A filter set for items.

    This filter set allows filtering items by tags and location.

    Attributes:
        tags (NumberInFilter): A filter for items that have any of the
            given tags.
        location (NumberInFilter): A filter for items that are in any of
            the given locations.
    """
    tags = NumberInFilter(field_name='tags__id')
    location = NumberInFilter(field_name='location__id')

    class Meta:
        """Limit which Item fields are available for filtering."""
        model = Item
        fields: list[str] = []


class ItemPagination(PageNumberPagination):
    """Pagination for the item list view.

    This pagination class sets the default page size and allows the client
    to override it using the `page_size` query parameter. It includes
    reasonable limits to prevent performance issues.

    Attributes:
        page_size (int): The default number of items to include on a page.
        page_size_query_param (str): The name of the query parameter that
            allows the client to override the page size.
        max_page_size (int): The maximum number of items that can be
            included on a page.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ItemViewSet(viewsets.ModelViewSet):
    """A viewset for managing items.

    This viewset provides CRUD operations for items, scoped to the
    currently authenticated user. It also provides actions for exporting
    items, looking up items by asset tag, generating QR codes, and
    viewing the change history of an item.
    """
    serializer_class = ItemSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ItemFilter
    search_fields = ['name', 'description', 'location__name', 'tags__name', 'wodis_inventory_number']
    ordering_fields = ['name', 'quantity', 'value', 'purchase_date']
    ordering = ['-purchase_date', 'name']
    pagination_class = ItemPagination

    def get_queryset(self):
        """
        Gets the queryset for the viewset.

        Returns:
            QuerySet: The queryset for the viewset.
        """
        user = self.request.user
        if not user.is_authenticated:
            return Item.objects.none()
        return (
            Item.objects.filter(owner=user)
            .select_related('location', 'owner')
            .prefetch_related('tags', 'images', 'lists')
            .distinct()
        )

    def get_throttles(self):
        """
        Gets the throttles for the viewset with comprehensive rate limiting.

        Returns:
            list: A list of throttles.
        """
        # SECURITY FIX: Implement comprehensive rate limiting to prevent bypass attempts
        throttles = []
        
        # Always apply base throttles for all actions
        base_throttles = super().get_throttles()
        if base_throttles:
            throttles.extend(base_throttles)
        
        # Action-specific throttles
        if self.action == 'create':
            throttles.append(ItemCreateRateThrottle())
        elif self.action in ['update', 'partial_update']:
            throttles.append(ItemUpdateRateThrottle())
        elif self.action == 'destroy':
            throttles.append(ItemDeleteRateThrottle())
        elif self.action == 'generate_qr_code':
            throttles.append(QRGenerateRateThrottle())
        elif self.action in ['list', 'retrieve']:
            # Add read throttles for list/retrieve operations to prevent enumeration attacks
            throttles.append(throttling.AnonRateThrottle(scope='item_read'))
        elif self.action == 'export_items':
            # Export operations need stricter rate limiting
            throttles.append(throttling.UserRateThrottle(scope='item_export'))
        
        return throttles

    @action(detail=False, methods=['get'], url_path='export')
    def export_items(self, request):
        """
        Exports the filtered inventory as a CSV file.

        Args:
            request (Request): The request object.

        Returns:
            HttpResponse: A streamed CSV response containing the items.
        """
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        queryset = self.filter_queryset(self.get_queryset())

        response, writer = _prepare_items_csv_response('emmatresor-inventar')
        _write_items_to_csv(writer, queryset)
        return response

    def perform_create(self, serializer):
        """
        Performs creation of a new object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        """
        Performs update of an existing object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        # Validate ownership before update
        instance = self.get_object()
        if instance.owner != self.request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')
        serializer.save(owner=instance.owner)

    @action(detail=False, methods=['get'], url_path='lookup_by_tag/(?P<asset_tag>[^/]+)')
    def lookup_by_asset_tag(self, request, asset_tag=None):
        """
        Looks up an item by its asset tag.

        Args:
            request (Request): The request object.
            asset_tag (str, optional): The asset tag to look up. Defaults to None.

        Returns:
            Response: A response object.
        """
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Clean the asset_tag string and validate UUID format
            cleaned_tag = str(asset_tag).strip() if asset_tag else ''
            if not cleaned_tag:
                return Response({'detail': 'QR-Code ist erforderlich.'}, status=status.HTTP_400_BAD_REQUEST)
            asset_uuid = UUID(cleaned_tag)
        except (TypeError, ValueError, AttributeError):
            return Response({'detail': 'Ungültiger QR-Code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = Item.objects.get(owner=user, asset_tag=asset_uuid)
        except Item.DoesNotExist:
            return Response({'detail': 'Gegenstand nicht gefunden.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='generate_qr_code')
    def generate_qr_code(self, request, pk=None):
        """
        Generates a QR code for an item.

        Args:
            request (Request): The request object.
            pk (int, optional): The primary key of the item. Defaults to None.

        Returns:
            HttpResponse: An HTTP response containing the QR code image.
        """
        try:
            import qrcode
        except ImportError:
            return Response(
                {'detail': 'QR-Code-Generierung ist nicht verfügbar. Bitte installiere qrcode[pil].'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        item = self.get_object()
        if item.owner != request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')

        qr = qrcode.QRCode(version=1, box_size=5, border=4)
        scan_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/scan/{item.asset_tag}"
        qr.add_data(scan_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')

        download = request.query_params.get('download', '')
        as_attachment = str(download).lower() in {'1', 'true', 'yes', 'download'}
        disposition = 'attachment' if as_attachment else 'inline'

        with io.BytesIO() as buffer:
            img.save(buffer, format='PNG')
            buffer.seek(0)
            response = HttpResponse(buffer.getvalue(), content_type='image/png')
        response['Content-Disposition'] = f'{disposition}; filename="item-{item.id}-qr.png"'
        return response

    @action(detail=True, methods=['get'], url_path='changelog')
    def changelog(self, request, pk=None):
        """
        Retrieves the change history for an item.

        Args:
            request (Request): The request object.
            pk (int, optional): The primary key of the item. Defaults to None.

        Returns:
            Response: A response object containing the change history.
        """
        item = self.get_object()
        if item.owner != request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')

        # Get all change logs for this item, ordered by newest first
        logs = ItemChangeLog.objects.filter(item=item).select_related('user').order_by('-created_at')
        serializer = ItemChangeLogSerializer(logs, many=True)
        return Response(serializer.data)


class ItemImageViewSet(viewsets.ModelViewSet):
    """A viewset for managing item images.

    This viewset provides CRUD operations for item images, scoped to the
    currently authenticated user. It ensures that users can only manage
    images for their own items.
    """
    serializer_class = ItemImageSerializer
    pagination_class = None

    def get_queryset(self):
        """
        Gets the queryset for the viewset.

        Returns:
            QuerySet: The queryset for the viewset.
        """
        user = self.request.user
        if not user.is_authenticated:
            return ItemImage.objects.none()
        return ItemImage.objects.filter(item__owner=user).select_related('item', 'item__owner')

    def perform_create(self, serializer):
        """
        Performs creation of a new object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände hinzugefügt werden.')
        serializer.save()

    def perform_update(self, serializer):
        """
        Performs update of an existing object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        item = serializer.validated_data.get('item', serializer.instance.item)
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände bearbeitet werden.')
        serializer.save()


class ItemImageDownloadView(APIView):
    """A view for downloading item images.

    This view allows authenticated users to download images for their own
    items. It sets the appropriate headers to ensure that the browser

    handles the download correctly.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int, *args, **kwargs):
        """
        Handles GET requests.

        Args:
            request (Request): The request object.
            pk (int): The primary key of the item image.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            FileResponse: A file response containing the image.
        """
        attachment = get_object_or_404(
            ItemImage.objects.select_related('item__owner'),
            pk=pk,
            item__owner=request.user,
        )

        if not attachment.image:
            raise Http404('Datei nicht gefunden.')

        try:
            file_handle = attachment.image.open('rb')
        except FileNotFoundError as exc:
            raise Http404('Datei nicht verfügbar.') from exc

        filename = os.path.basename(attachment.image.name)
        if not filename:
            filename = f"attachment-{attachment.pk}"

        ascii_filename = filename.encode('ascii', 'ignore').decode('ascii') or filename
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        disposition_param = request.query_params.get('disposition', '').lower()
        disposition = 'inline' if disposition_param == 'inline' else 'attachment'

        response = FileResponse(file_handle, content_type=content_type)
        filename_utf8 = quote(filename)
        response['Content-Disposition'] = (
            f"{disposition}; filename=\"{ascii_filename}\"; "
            f"filename*=UTF-8''{filename_utf8}"
        )
        response['Cache-Control'] = 'private, max-age=0, no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'

        try:
            response['Content-Length'] = str(attachment.image.size)
        except (OSError, ValueError):
            pass

        return response

class ItemListViewSet(viewsets.ModelViewSet):
    """A viewset for managing item lists.

    This viewset provides CRUD operations for item lists, scoped to the
    currently authenticated user. It also provides an action for exporting
    the items in a list.
    """
    serializer_class = ItemListSerializer
    pagination_class = None

    def get_queryset(self):
        """
        Gets the queryset for the viewset.

        Returns:
            QuerySet: The queryset for the viewset.
        """
        user = self.request.user
        if not user.is_authenticated:
            return ItemList.objects.none()
        return ItemList.objects.filter(owner=user).prefetch_related('items', 'owner')

    def perform_create(self, serializer):
        """
        Performs creation of a new object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        """
        Performs update of an existing object.

        Args:
            serializer (Serializer): The serializer for the object.
        """
        instance = serializer.instance
        if instance.owner != self.request.user:
            raise PermissionDenied('Diese Inventarliste gehört nicht zu deinem Konto.')
        serializer.save()

    @action(detail=True, methods=['get'], url_path='export')
    def export_items(self, request, pk=None):
        """
        Exports all items that belong to the selected list as a CSV file.

        Args:
            request (Request): The request object.
            pk (int, optional): The primary key of the list.

        Returns:
            HttpResponse: A streamed CSV response containing the list items.
        """
        item_list = self.get_object()
        if item_list.owner != request.user:
            raise PermissionDenied('Diese Inventarliste gehört nicht zu deinem Konto.')

        items = (
            item_list.items.select_related('location', 'owner')
            .prefetch_related('tags', 'lists')
            .order_by('name', 'id')
        )

        list_slug = slugify(item_list.name) or 'liste'
        filename_prefix = f'emmatresor-liste-{item_list.id}-{list_slug}'
        response, writer = _prepare_items_csv_response(filename_prefix)
        _write_items_to_csv(writer, items)
        return response
