"""Custom DRF throttle classes for the inventory API."""

from rest_framework import throttling


class LoginRateThrottle(throttling.AnonRateThrottle):
    """Rate limiter for login attempts - prevents brute force attacks."""
    scope = 'login'


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


__all__ = [
    'ItemCreateRateThrottle',
    'ItemDeleteRateThrottle',
    'ItemExportRateThrottle',
    'ItemImageDownloadRateThrottle',
    'ItemReadRateThrottle',
    'ItemUpdateRateThrottle',
    'LoginRateThrottle',
    'LogoutRateThrottle',
    'QRGenerateRateThrottle',
    'RegisterRateThrottle',
]
