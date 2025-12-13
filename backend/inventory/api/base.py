"""Common base classes for inventory API viewsets."""

from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied


class UserScopedModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that implements user-scoped data isolation.

    Ensures users can only access and modify their own data.
    All queries are automatically filtered by user ownership.

    Subclasses must set:
    - owner_field: Name of the foreign key field pointing to user (default: 'user')
    """
    owner_field = 'user'  # Field name that references the user
    pagination_class = None  # Disable pagination by default

    def get_queryset(self):
        """
        Filter queryset to only include current user's data.

        Returns:
            QuerySet: Filtered queryset containing only user's owned objects
        """
        queryset = super().get_queryset()
        user = self.request.user

        # Return empty queryset for unauthenticated users
        if not user.is_authenticated:
            return queryset.none()

        # Filter by user ownership
        filter_kwargs = {f'{self.owner_field}__id': user.id}
        return queryset.filter(**filter_kwargs)

    def perform_create(self, serializer):
        """
        Automatically set owner when creating new objects.

        Args:
            serializer: Validated serializer instance
        """
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """
        Verify ownership before allowing updates.

        Args:
            serializer: Validated serializer instance

        Raises:
            PermissionDenied: If object doesn't belong to current user
        """
        instance = serializer.instance

        # Handle edge case where instance is None
        if instance is None:
            serializer.save(user=self.request.user)
            return

        # Verify ownership
        owner_value = getattr(instance, self.owner_field)
        if owner_value != self.request.user:
            raise PermissionDenied('Diese Ressource gehört nicht zu deinem Konto.')

        serializer.save()


__all__ = ['UserScopedModelViewSet']
