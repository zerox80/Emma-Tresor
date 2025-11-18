"""Tag and location CRUD viewsets."""

from ..models import Location, Tag
from ..serializers import LocationSerializer, TagSerializer
from .base import UserScopedModelViewSet


class TagViewSet(UserScopedModelViewSet):
    """
    ViewSet for managing user tags.

    Provides CRUD operations for tags with automatic user scoping.
    Each user can only see and manage their own tags.
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class LocationViewSet(UserScopedModelViewSet):
    """
    ViewSet for managing storage locations.

    Provides CRUD operations for locations with automatic user scoping.
    Each user can only see and manage their own locations.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer


__all__ = ['LocationViewSet', 'TagViewSet']
