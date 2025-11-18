"""
CSV export utilities used across inventory API views.

Provides helper functions to consistently format dates/decimals and
produce HttpResponse objects for CSV downloads with German defaults.
"""

from __future__ import annotations

import csv

from django.http import HttpResponse
from django.utils import timezone

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


__all__ = [
    'ITEM_EXPORT_HEADERS',
    '_format_decimal',
    '_format_date',
    '_format_datetime',
    '_prepare_items_csv_response',
    '_write_items_to_csv',
]
