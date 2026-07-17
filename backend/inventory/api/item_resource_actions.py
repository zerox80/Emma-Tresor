"""Resource actions shared by the inventory item view set."""

from __future__ import annotations

import io
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import Item, ItemChangeLog
from ..audit import audit_actor
from ..serializers import ItemChangeLogSerializer
from .export import _prepare_items_csv_response, _write_items_to_csv


class ItemResourceActionsMixin:
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
        with transaction.atomic(), audit_actor(self.request.user):
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
        with transaction.atomic(), audit_actor(self.request.user):
            serializer.save(owner=instance.owner)

    def perform_destroy(self, instance):
        with transaction.atomic(), audit_actor(self.request.user):
            instance.delete()

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
