"""
Backward-compatible shim that exposes all API views.

The actual implementations now live in the ``inventory.api`` package to keep
the backend maintainable and logically grouped by domain.
"""

from .api.auth import (
    CurrentUserView,
    CustomTokenObtainPairSerializer,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    GetCSRFTokenView,
    LogoutView,
    UserRegistrationViewSet,
    _build_cookie_options,
    _clear_token_cookies,
    _coerce_bool,
    _set_token_cookies,
)
from .api.base import UserScopedModelViewSet
from .api.duplicates import DuplicateQuarantineViewSet
from .api.images import ItemImageDownloadView, ItemImageViewSet
from .api.items import ItemFilter, ItemPagination, ItemViewSet, NumberInFilter
from .api.lists import ItemListViewSet
from .api.taxonomy import LocationViewSet, TagViewSet
from .api.throttles import (
    ItemCreateRateThrottle,
    ItemDeleteRateThrottle,
    ItemExportRateThrottle,
    ItemImageDownloadRateThrottle,
    ItemReadRateThrottle,
    ItemUpdateRateThrottle,
    LoginRateThrottle,
    LogoutRateThrottle,
    QRGenerateRateThrottle,
    RegisterRateThrottle,
)

__all__ = [
    # Auth helpers + views
    'CurrentUserView',
    'CustomTokenObtainPairSerializer',
    'CustomTokenObtainPairView',
    'CustomTokenRefreshView',
    'GetCSRFTokenView',
    'LogoutView',
    'UserRegistrationViewSet',
    '_build_cookie_options',
    '_clear_token_cookies',
    '_coerce_bool',
    '_set_token_cookies',
    # Base classes
    'UserScopedModelViewSet',
    # Domain viewsets
    'DuplicateQuarantineViewSet',
    'ItemFilter',
    'ItemImageDownloadView',
    'ItemImageViewSet',
    'ItemListViewSet',
    'ItemPagination',
    'ItemViewSet',
    'LocationViewSet',
    'NumberInFilter',
    'TagViewSet',
    # Throttles
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
