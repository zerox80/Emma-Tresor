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
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from django_filters import rest_framework as django_filters

from .models import Item, ItemImage, ItemList, Location, Tag
from .serializers import (
    ItemImageSerializer,
    ItemListSerializer,
    ItemSerializer,
    LocationSerializer,
    TagSerializer,
    UserRegistrationSerializer,
)


User = get_user_model()


def _coerce_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


def _build_cookie_options(path: str):
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
    access_options = _build_cookie_options(settings.JWT_ACCESS_COOKIE_PATH)
    refresh_options = _build_cookie_options(settings.JWT_REFRESH_COOKIE_PATH)

    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, **access_options)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, **refresh_options)
    response.delete_cookie(settings.JWT_REMEMBER_COOKIE_NAME, **access_options)


class LoginRateThrottle(throttling.AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(throttling.AnonRateThrottle):
    scope = 'register'


class LogoutRateThrottle(throttling.AnonRateThrottle):
    scope = 'logout'


class ItemCreateRateThrottle(throttling.UserRateThrottle):
    scope = 'item_create'


class ItemUpdateRateThrottle(throttling.UserRateThrottle):
    scope = 'item_update'


class ItemDeleteRateThrottle(throttling.UserRateThrottle):
    scope = 'item_delete'


class QRGenerateRateThrottle(throttling.UserRateThrottle):
    scope = 'qr_generate'


@method_decorator(csrf_exempt, name='dispatch')
class UserRegistrationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer
    throttle_classes = [RegisterRateThrottle]
    http_method_names = ['post']

    def create(self, request, *args, **kwargs):
        if not settings.ALLOW_USER_REGISTRATION:
            return Response(
                {'detail': 'Registrierungen sind derzeit deaktiviert.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField(required=False, allow_blank=False)
        self.fields[self.username_field].required = False

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        import logging
        import time
        import secrets
        security_logger = logging.getLogger('security')
        
        # Measure execution time to ensure constant-time behavior
        start_time = time.perf_counter()
        
        email = attrs.get('email')
        if email:
            email = email.strip().lower()
            attrs['email'] = email

        username = attrs.get(self.username_field)
        user_found = False
        
        if email and not username:
            try:
                user = User.objects.get(email__iexact=email)
                attrs[self.username_field] = getattr(user, self.username_field)
                user_found = True
            except User.DoesNotExist:
                # Perform dummy operation to maintain constant time
                # This prevents timing attacks that could enumerate users
                _ = secrets.compare_digest(email, 'dummy@example.com')
                
                # Use generic error message to prevent user enumeration
                security_logger.warning(
                    'Login attempt with non-existent email',
                    extra={'email': email[:50]}  # Truncate for logging
                )
        
        # Add artificial delay to normalize timing for failed user lookups
        if not user_found and email and not username:
            # Calculate elapsed time and add delay if needed
            elapsed = time.perf_counter() - start_time
            target_time = 0.1  # Target 100ms minimum
            if elapsed < target_time:
                time.sleep(target_time - elapsed)
            raise AuthenticationFailed('Ungültige Anmeldedaten.')
        
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            # Add timing normalization for failed authentication
            elapsed = time.perf_counter() - start_time
            target_time = 0.15  # Slightly longer for full authentication attempt
            if elapsed < target_time:
                time.sleep(target_time - elapsed)
            # Generic error message for failed authentication
            raise AuthenticationFailed('Ungültige Anmeldedaten.')
        
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
        }
        return data


@method_decorator(csrf_exempt, name='dispatch')
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
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


@method_decorator(csrf_exempt, name='dispatch')
class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        return Response(
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            }
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request, *args, **kwargs):
        refresh_token = (
            request.data.get('refresh')
            or request.data.get('refresh_token')
            or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        )

        response = Response(status=status.HTTP_204_NO_CONTENT)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token_user_id = token.payload.get('user_id')
                if token_user_id != request.user.id:
                    error_response = Response(
                        {'detail': 'Aktualisierungstoken gehört nicht zu deinem Konto.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                    _clear_token_cookies(error_response)
                    return error_response
                try:
                    token.blacklist()
                except TokenError:
                    pass
            except TokenError:
                # Invalid token – clear cookies and treat as logged out
                _clear_token_cookies(response)
                return response

        _clear_token_cookies(response)
        return response


class UserScopedModelViewSet(viewsets.ModelViewSet):
    owner_field = 'user'
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        # Safe field lookup without f-string interpolation
        filter_kwargs = {f'{self.owner_field}__id': user.id}
        return queryset.filter(**filter_kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
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
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class LocationViewSet(UserScopedModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer



class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    pass


class ItemFilter(django_filters.FilterSet):
    tags = NumberInFilter(field_name='tags__id')
    location = NumberInFilter(field_name='location__id')

    class Meta:
        model = Item
        fields: list[str] = []


class ItemPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ItemFilter
    search_fields = ['name', 'description', 'location__name', 'tags__name']
    ordering_fields = ['name', 'quantity', 'value', 'purchase_date']
    ordering = ['-purchase_date', 'name']
    pagination_class = ItemPagination

    def get_queryset(self):
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
        throttles = []
        if self.action == 'create':
            throttles.append(ItemCreateRateThrottle())
        elif self.action in ['update', 'partial_update']:
            throttles.append(ItemUpdateRateThrottle())
        elif self.action == 'destroy':
            throttles.append(ItemDeleteRateThrottle())
        elif self.action == 'generate_qr_code':
            throttles.append(QRGenerateRateThrottle())
        else:
            throttles = super().get_throttles()
        return throttles

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        # Validate ownership before update
        instance = self.get_object()
        if instance.owner != self.request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')
        serializer.save(owner=instance.owner)

    @action(detail=False, methods=['get'], url_path='lookup_by_tag/(?P<asset_tag>[^/]+)')
    def lookup_by_asset_tag(self, request, asset_tag=None):
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


class ItemImageViewSet(viewsets.ModelViewSet):
    serializer_class = ItemImageSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ItemImage.objects.none()
        return ItemImage.objects.filter(item__owner=user).select_related('item', 'item__owner')

    def perform_create(self, serializer):
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände hinzugefügt werden.')
        serializer.save()

    def perform_update(self, serializer):
        item = serializer.validated_data.get('item', serializer.instance.item)
        if item.owner != self.request.user:
            raise PermissionDenied('Bilder können nur für eigene Gegenstände bearbeitet werden.')
        serializer.save()


class ItemImageDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int, *args, **kwargs):
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
    serializer_class = ItemListSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ItemList.objects.none()
        return ItemList.objects.filter(owner=user).prefetch_related('items', 'owner')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.owner != self.request.user:
            raise PermissionDenied('Diese Inventarliste gehört nicht zu deinem Konto.')
        serializer.save()
