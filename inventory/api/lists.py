"""Item list management viewset."""

from django.utils.text import slugify
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied

from ..models import ItemList
from ..serializers import ItemListSerializer
from .export import _prepare_items_csv_response, _write_items_to_csv


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
            HttpResponse: CSV response with list items

        Raises:
            PermissionDenied: If list doesn't belong to user
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


__all__ = ['ItemListViewSet']
