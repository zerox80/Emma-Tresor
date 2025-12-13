"""
Inventory item API: filters, pagination, and the main ItemViewSet implementation.
"""

from __future__ import annotations

import io
from typing import Literal, cast
from uuid import UUID

from django.conf import settings
from django.http import HttpResponse
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from django_filters import rest_framework as django_filters

from ..models import DuplicateQuarantine, Item, ItemChangeLog
from ..serializers import (
    DuplicateCandidateSerializer,
    ItemChangeLogSerializer,
    ItemSerializer,
)
from .export import _prepare_items_csv_response, _write_items_to_csv
from .throttles import (
    ItemCreateRateThrottle,
    ItemDeleteRateThrottle,
    ItemExportRateThrottle,
    ItemReadRateThrottle,
    ItemUpdateRateThrottle,
    QRGenerateRateThrottle,
)


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
    duplicate_default_limit = 250

    DUPLICATE_NAME_CHOICES: set[str] = {'none', 'exact', 'prefix', 'contains'}
    DUPLICATE_DESCRIPTION_CHOICES: set[str] = {'none', 'exact', 'contains'}
    DUPLICATE_WODIS_CHOICES: set[str] = {'none', 'exact'}

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

    @action(detail=False, methods=['get'], url_path='duplicates')
    def find_duplicates(self, request):
        """Analyze potential duplicate items based on flexible matching rules."""

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        queryset = self.filter_queryset(self.get_queryset())
        options = self._parse_duplicate_options(request)
        if not options['active_criteria']:
            return Response(
                {'detail': 'Mindestens ein Vergleichskriterium muss aktiviert sein.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = options['limit']
        items = list(queryset.order_by('name', 'id')[:limit])
        if not items:
            return Response({'count': 0, 'results': [], 'analyzed_count': 0})

        quarantined_pairs = self._load_quarantine_pairs(request.user)
        groups = self._build_duplicate_groups(items, options, quarantined_pairs)

        serializer = DuplicateCandidateSerializer
        response_payload = [
            {
                'group_id': index + 1,
                'match_reasons': group['reasons'],
                'items': serializer(group['items'], many=True).data,
            }
            for index, group in enumerate(groups)
        ]

        return Response(
            {
                'count': len(response_payload),
                'results': response_payload,
                'analyzed_count': len(items),
                'limit': limit,
                'preset_used': options.get('preset_used'),
            }
        )

    def _parse_duplicate_options(self, request):
        preset = (request.query_params.get('preset') or '').lower().strip()
        if preset == 'auto':
            return {
                'name_match': 'prefix',
                'description_match': 'contains',
                'wodis_match': 'exact',
                'purchase_tolerance': 30,
                'active_criteria': True,
                'limit': self.duplicate_default_limit,
                'preset_used': 'auto',
                'require_any_text_match': False,
            }

        name_match = request.query_params.get('name_match', 'exact').lower()
        description_match = request.query_params.get('description_match', 'none').lower()
        wodis_match = request.query_params.get('wodis_match', 'none').lower()
        tolerance_raw = request.query_params.get('purchase_date_tolerance_days')
        limit_raw = request.query_params.get('limit')
        any_text_raw = request.query_params.get('require_any_text_match')

        if name_match not in self.DUPLICATE_NAME_CHOICES:
            raise serializers.ValidationError({'name_match': 'Ungültiger Wert für name_match.'})
        if description_match not in self.DUPLICATE_DESCRIPTION_CHOICES:
            raise serializers.ValidationError({'description_match': 'Ungültiger Wert für description_match.'})
        if wodis_match not in self.DUPLICATE_WODIS_CHOICES:
            raise serializers.ValidationError({'wodis_match': 'Ungültiger Wert für wodis_match.'})

        tolerance = None
        if tolerance_raw not in (None, ''):
            try:
                tolerance = int(tolerance_raw)
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError({'purchase_date_tolerance_days': 'Bitte gib eine ganze Zahl an.'}) from exc

            if tolerance < 0 or tolerance > 365:
                raise serializers.ValidationError({'purchase_date_tolerance_days': 'Wert muss zwischen 0 und 365 liegen.'})

        limit = self.duplicate_default_limit
        if limit_raw not in (None, ''):
            try:
                parsed_limit = int(limit_raw)
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError({'limit': 'Limit muss eine ganze Zahl sein.'}) from exc
            limit = max(25, min(parsed_limit, 500))

        require_any_text_match = False
        if any_text_raw not in (None, ''):
            require_any_text_match = str(any_text_raw).strip().lower() in {'1', 'true', 'yes', 'on'}

        return {
            'name_match': cast(Literal['none', 'exact', 'prefix', 'contains'], name_match),
            'description_match': cast(Literal['none', 'exact', 'contains'], description_match),
            'wodis_match': cast(Literal['none', 'exact'], wodis_match),
            'purchase_tolerance': tolerance,
            'active_criteria': any([
                name_match != 'none',
                description_match != 'none',
                wodis_match != 'none',
                tolerance is not None,
            ]),
            'limit': limit,
            'preset_used': None,
            'require_any_text_match': require_any_text_match,
        }

    @staticmethod
    def _normalise_text(value: str | None) -> str:
        if not value:
            return ''
        return ' '.join(value.strip().lower().split())

    def _match_text(self, left: str | None, right: str | None, mode: Literal['exact', 'prefix', 'contains']) -> bool:
        normal_left = self._normalise_text(left)
        normal_right = self._normalise_text(right)
        if not normal_left or not normal_right:
            return False

        if mode == 'exact':
            return normal_left == normal_right

        if mode == 'prefix':
            prefix_len = 5 if len(normal_left) >= 5 and len(normal_right) >= 5 else 3
            prefix_len = max(3, prefix_len)
            return normal_left[:prefix_len] == normal_right[:prefix_len]

        if mode == 'contains':
            shorter, longer = sorted([normal_left, normal_right], key=len)
            if len(shorter) < 4:
                return False
            return shorter in longer

        return False

    def _match_purchase_date(self, item_one: Item, item_two: Item, tolerance: int) -> bool:
        if not item_one.purchase_date or not item_two.purchase_date:
            return False
        delta = abs((item_one.purchase_date - item_two.purchase_date).days)
        return delta <= tolerance

    def _items_match(self, item_one: Item, item_two: Item, options) -> set[str]:
        reasons: set[str] = set()

        name_mode = options['name_match']
        desc_mode = options['description_match']
        require_any_text_match = options.get('require_any_text_match', False)
        text_field_checked = 0
        text_match_found = False

        if name_mode != 'none':
            text_field_checked += 1
            if self._match_text(item_one.name, item_two.name, name_mode):
                reasons.add(self._label_for_field('name', name_mode))
                text_match_found = True
            elif not require_any_text_match:
                return set()

        if desc_mode != 'none':
            text_field_checked += 1
            if self._match_text(item_one.description, item_two.description, desc_mode):
                reasons.add(self._label_for_field('description', desc_mode))
                text_match_found = True
            elif not require_any_text_match:
                return set()

        if require_any_text_match and text_field_checked > 0 and not text_match_found:
            return set()

        wodis_mode = options['wodis_match']
        if wodis_mode != 'none':
            left = self._normalise_text(item_one.wodis_inventory_number)
            right = self._normalise_text(item_two.wodis_inventory_number)
            if not left or not right:
                return set()
            if left != right:
                return set()
            reasons.add(self._label_for_field('wodis', 'exact'))

        tolerance = options['purchase_tolerance']
        if tolerance is not None:
            if not self._match_purchase_date(item_one, item_two, tolerance):
                return set()
            tolerance_label = f'Kaufdatum (±{tolerance} Tage)'
            reasons.add(tolerance_label)

        return reasons

    @staticmethod
    def _label_for_field(field: str, mode: str) -> str:
        labels = {
            'name': {
                'exact': 'Name (genau)',
                'prefix': 'Name (Anfang passt)',
                'contains': 'Name (enthält)',
            },
            'description': {
                'exact': 'Beschreibung (genau)',
                'contains': 'Beschreibung (enthält)',
            },
            'wodis': {
                'exact': 'WODIS-Nummer',
            },
        }
        return labels.get(field, {}).get(mode, field)

    def _load_quarantine_pairs(self, user):
        if not user or not user.is_authenticated:
            return set()
        entries = DuplicateQuarantine.objects.filter(owner=user, is_active=True).values_list('item_a_id', 'item_b_id')
        return {(min(a, b), max(a, b)) for a, b in entries}

    @staticmethod
    def _is_quarantined_pair(item_one_id, item_two_id, quarantine_pairs):
        key = (min(item_one_id, item_two_id), max(item_one_id, item_two_id))
        return key in quarantine_pairs

    def _build_duplicate_groups(self, items, options, quarantine_pairs):
        total = len(items)
        adjacency: list[list[tuple[int, set[str]]]] = [[] for _ in range(total)]

        for idx in range(total - 1):
            base = items[idx]
            for compare_index in range(idx + 1, total):
                candidate = items[compare_index]
                reasons = self._items_match(base, candidate, options)
                if reasons:
                    if self._is_quarantined_pair(base.id, candidate.id, quarantine_pairs):
                        continue
                    adjacency[idx].append((compare_index, reasons))
                    adjacency[compare_index].append((idx, reasons))

        visited: set[int] = set()
        groups: list[dict[str, list]] = []

        for idx in range(total):
            if idx in visited or not adjacency[idx]:
                continue

            stack = [idx]
            component_indices = []
            reason_accumulator: set[str] = set()

            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                component_indices.append(current)

                for neighbor, edge_reasons in adjacency[current]:
                    reason_accumulator.update(edge_reasons)
                    if neighbor not in visited:
                        stack.append(neighbor)

            if len(component_indices) < 2:
                continue

            sorted_indices = sorted(component_indices, key=lambda i: (self._normalise_text(items[i].name), items[i].id))
            groups.append(
                {
                    'items': [items[i] for i in sorted_indices],
                    'reasons': sorted(reason_accumulator),
                }
            )

        groups.sort(key=lambda entry: len(entry['items']), reverse=True)
        return groups

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


__all__ = ['ItemFilter', 'ItemPagination', 'ItemViewSet', 'NumberInFilter']
