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


from .item_duplicate_actions import DuplicateFinderMixin
from .item_resource_actions import ItemResourceActionsMixin

class ItemViewSet(DuplicateFinderMixin, ItemResourceActionsMixin, viewsets.ModelViewSet):
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
