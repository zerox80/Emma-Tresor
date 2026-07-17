"""Custom DRF throttle classes for the inventory API."""

import hashlib

from rest_framework import throttling


class LoginRateThrottle(throttling.SimpleRateThrottle):
    """Rate limiter for login attempts by normalized email or username."""
    scope = 'login'

    def get_cache_key(self, request, view):
        identifier = self._get_identifier(request)
        if not identifier:
            identifier = self.get_ident(request)

        digest = hashlib.sha256(identifier.encode('utf-8')).hexdigest()
        return self.cache_format % {
            'scope': self.scope,
            'ident': digest,
        }

    @staticmethod
    def _get_identifier(request) -> str | None:
        try:
            data = getattr(request, 'data', None)
        except Exception:
            data = None

        if not hasattr(data, 'get'):
            return None

        raw_identifier = data.get('email') or data.get('username')
        if raw_identifier is None:
            return None

        identifier = str(raw_identifier).strip().lower()
        return identifier or None


class LoginIPRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for login attempts by trusted client IP."""
    scope = 'login_ip'


class RegisterRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for user registration - prevents spam account creation."""
    scope = 'register'


class LogoutRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for logout operations - prevents logout spam."""
    scope = 'logout'


class ItemCreateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for creating new items - prevents inventory spam."""
    scope = 'item_create'


class ItemUpdateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for updating items - prevents excessive updates."""
    scope = 'item_update'


class ItemDeleteRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for deleting items - prevents accidental mass deletion."""
    scope = 'item_delete'


class QRGenerateRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for QR code generation - prevents resource exhaustion."""
    scope = 'qr_generate'


class ItemImageDownloadRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for image downloads - prevents bandwidth abuse."""
    scope = 'image_download'


class ItemReadRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for reading items - prevents excessive API calls."""
    scope = 'item_read'


class ItemExportRateThrottle(throttling.UserRateThrottle):
    """Rate limiter for CSV exports - prevents resource exhaustion."""
    scope = 'item_export'


class DuplicateFinderRateThrottle(throttling.UserRateThrottle):
    """Protect the CPU-intensive duplicate analysis endpoint."""

    scope = 'duplicate_find'


__all__ = [
    'DuplicateFinderRateThrottle',
    'ItemCreateRateThrottle',
    'ItemDeleteRateThrottle',
    'ItemExportRateThrottle',
    'ItemImageDownloadRateThrottle',
    'ItemReadRateThrottle',
    'ItemUpdateRateThrottle',
    'LoginIPRateThrottle',
    'LoginRateThrottle',
    'LogoutRateThrottle',
    'QRGenerateRateThrottle',
    'RegisterRateThrottle',
]
