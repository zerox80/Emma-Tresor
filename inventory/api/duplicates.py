"""Duplicate quarantine API viewset."""

from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import DuplicateQuarantine
from ..serializers import DuplicateQuarantineSerializer


class DuplicateQuarantineViewSet(viewsets.ModelViewSet):
    """Manage user-defined false-positive duplicate pairs."""

    serializer_class = DuplicateQuarantineSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        queryset = DuplicateQuarantine.objects.filter(owner=self.request.user)
        is_active_param = self.request.query_params.get('is_active')
        if is_active_param in {'true', '1'}:
            queryset = queryset.filter(is_active=True)
        elif is_active_param in {'false', '0'}:
            queryset = queryset.filter(is_active=False)
        return queryset.select_related('item_a', 'item_b').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = True
        instance.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


__all__ = ['DuplicateQuarantineViewSet']
