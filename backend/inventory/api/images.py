"""Item image upload and download views."""

from __future__ import annotations

import mimetypes
import os
from urllib.parse import quote

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from ..models import ItemImage
from ..serializers import ItemImageSerializer
from .throttles import ItemImageDownloadRateThrottle


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
            filename = f'attachment-{attachment.pk}'

        # Create ASCII-safe filename for old clients
        ascii_filename = filename.encode('ascii', 'ignore').decode('ascii') or filename

        # Whitelist of allowed content types
        allowed_content_types = {
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/avif', 'image/heic', 'image/heif',
            'application/pdf',
        }

        # Determine content type
        guessed_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        # Validate content type
        if guessed_type not in allowed_content_types:
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


__all__ = ['ItemImageDownloadView', 'ItemImageViewSet']
