import io
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from rest_framework import filters, mixins, permissions, serializers, status, throttling, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
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
        email = attrs.get('email')
        if email:
            email = email.strip().lower()
            attrs['email'] = email

        username = attrs.get(self.username_field)
        if email and not username:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist as exc:
                raise AuthenticationFailed('Kein aktives Konto mit dieser E-Mail gefunden.') from exc
            attrs[self.username_field] = getattr(user, self.username_field)
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
        }
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class CustomTokenRefreshView(TokenRefreshView):
    pass


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
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh') or request.data.get('refresh_token')
        if not refresh_token:
            return Response({'detail': 'Aktualisierungstoken erforderlich.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
        except TokenError:
            return Response({'detail': 'Aktualisierungstoken ungültig.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token.blacklist()
        except TokenError:
            # Token already blacklisted or expired – treat as logged out.
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
    ordering = ['name']
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
        throttles = super().get_throttles()
        if self.action == 'create':
            throttles.append(ItemCreateRateThrottle())
        elif self.action in ['update', 'partial_update']:
            throttles.append(ItemUpdateRateThrottle())
        elif self.action == 'destroy':
            throttles.append(ItemDeleteRateThrottle())
        elif self.action == 'generate_qr_code':
            throttles.append(QRGenerateRateThrottle())
        return throttles

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        # Validate ownership before update
        instance = self.get_object()
        if instance.owner != self.request.user:
            raise PermissionDenied('Dieser Gegenstand gehört nicht zu deinem Konto.')
        serializer.save()

    @action(detail=False, methods=['get'], url_path='lookup_by_tag/(?P<asset_tag>[^/]+)')
    def lookup_by_asset_tag(self, request, asset_tag=None):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            asset_uuid = UUID(str(asset_tag).strip())
        except (TypeError, ValueError, AttributeError, UnicodeDecodeError):
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

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        scan_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/scan/{item.asset_tag}"
        qr.add_data(scan_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')

        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type='image/png')
        download = request.query_params.get('download', '')
        as_attachment = str(download).lower() in {'1', 'true', 'yes', 'download'}
        disposition = 'attachment' if as_attachment else 'inline'
        response['Content-Disposition'] = f'{disposition}; filename="item-{item.id}-qr.png"'
        return response


class ItemImageViewSet(viewsets.ModelViewSet):
    serializer_class = ItemImageSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ItemImage.objects.none()
        return ItemImage.objects.filter(item__owner=user).select_related('item')

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
        serializer.save(owner=self.request.user)
