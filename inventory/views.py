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
    
    if value is None:
        return ''
    return format(value, '.2f')

def _format_date(value):
    
    if value is None:
        return ''
    return value.isoformat()

def _format_datetime(value):
    
    if value is None:
        return ''
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_default_timezone())
    localized = timezone.localtime(value)
    return localized.strftime('%Y-%m-%d %H:%M:%S')

def _prepare_items_csv_response(filename_prefix):
    
    timestamp = timezone.localtime().strftime('%Y%m%d-%H%M%S')
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename=\"{filename_prefix}-{timestamp}.csv\"'
    response.write('\ufeff')
    writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(ITEM_EXPORT_HEADERS)
    return response, writer

def _write_items_to_csv(writer, items):
    
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

class ItemImageDownloadRateThrottle(throttling.UserRateThrottle):
    
    scope = 'image_download'

class ItemReadRateThrottle(throttling.UserRateThrottle):
    
    scope = 'item_read'

class ItemExportRateThrottle(throttling.UserRateThrottle):
    
    scope = 'item_export'

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
        import random
        security_logger = logging.getLogger('security')

        def constant_time_compare(a, b):
            
            return secrets.compare_digest(a, b)

        base_delay = random.uniform(0.20, 0.30)
        start_time = time.perf_counter()
        
        email = attrs.get('email')
        if email:
            email = email.strip().lower()
            attrs['email'] = email

        username = attrs.get(self.username_field)
        user_found = False
        authentication_result = None

        dummy_username = secrets.token_urlsafe(32)
        lookup_username = username if username else dummy_username
        lookup_email = email if email else f"{dummy_username}@example.com"

        try:
            if email and not username:

                user = User.objects.filter(email__iexact=lookup_email).first()
                if user:

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

            security_logger.error('Database error during authentication lookup')

        security_logger.info(
            'Authentication attempt processed',
            extra={
                'timestamp': time.time(),
                'ip_hash': secrets.token_hex(8)[:16],
            }
        )

        try:

            if not user_found:
                dummy_attrs = attrs.copy()
                if email and not username:
                    dummy_attrs[self.username_field] = dummy_username
                dummy_attrs['password'] = secrets.token_urlsafe(32)

                super().validate(dummy_attrs)
            else:
                data = super().validate(attrs)

            if not user_found:

                elapsed = time.perf_counter() - start_time
                target_with_variance = base_delay + random.uniform(0.10, 0.20)
                
                if elapsed < target_with_variance:
                    sleep_time = target_with_variance - elapsed
                    time.sleep(sleep_time)

                raise AuthenticationFailed('Ungültige Anmeldedaten.')

            data['user'] = {
                'id': authentication_result.id,
                'username': authentication_result.username,
                'email': authentication_result.email,
            }
            return data
            
        except AuthenticationFailed:

            elapsed = time.perf_counter() - start_time
            target_with_variance = base_delay + random.uniform(0.10, 0.20)
            
            if elapsed < target_with_variance:
                sleep_time = target_with_variance - elapsed
                time.sleep(sleep_time)

            raise AuthenticationFailed('Ungültige Anmeldedaten.')

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

@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFTokenView(APIView):
    
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        
        return Response({'detail': 'CSRF cookie set'}, status=status.HTTP_200_OK)

class LogoutView(APIView):
    
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request, *args, **kwargs):
        
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
    
    owner_field = 'user'
    pagination_class = None

    def get_queryset(self):
        
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

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
    search_fields = ['name', 'description', 'location__name', 'tags__name', 'wodis_inventory_number']
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

        base_throttles = super().get_throttles()
        if base_throttles:
            throttles.extend(base_throttles)

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
        
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        queryset = self.filter_queryset(self.get_queryset())

        response, writer = _prepare_items_csv_response('emmatresor-inventar')
        _write_items_to_csv(writer, queryset)
        return response

    def perform_create(self, serializer):
        
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):

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

    @action(detail=True, methods=['get'], url_path='changelog')
    def changelog(self, request, pk=None):
        
        item = self.get_object()
        if item.owner != request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')

        logs = ItemChangeLog.objects.filter(item=item).select_related('user').order_by('-created_at')
        serializer = ItemChangeLogSerializer(logs, many=True)
        return Response(serializer.data)

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
    throttle_classes = [ItemImageDownloadRateThrottle]

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

        ALLOWED_CONTENT_TYPES = {
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/avif', 'image/heic', 'image/heif',
            'application/pdf',
        }
        
        guessed_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        if guessed_type not in ALLOWED_CONTENT_TYPES:

            content_type = 'application/octet-stream'
        else:
            content_type = guessed_type

        disposition_param = request.query_params.get('disposition', '').lower()

        if content_type == 'application/pdf':
            disposition = 'attachment'
        else:
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

    @action(detail=True, methods=['get'], url_path='export')
    def export_items(self, request, pk=None):
        
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
