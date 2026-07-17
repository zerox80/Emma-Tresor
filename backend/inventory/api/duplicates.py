"""Duplicate quarantine API viewset."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import DuplicateQuarantine, Item
from ..serializers import DuplicateQuarantineSerializer


class DuplicatePairInputSerializer(serializers.Serializer):
    item_a_id = serializers.IntegerField(min_value=1)
    item_b_id = serializers.IntegerField(min_value=1)


class DuplicateBatchInputSerializer(serializers.Serializer):
    pairs = DuplicatePairInputSerializer(many=True, allow_empty=False, max_length=500)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=10000)


class DuplicateBatchReleaseSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=500,
    )


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

    @action(detail=False, methods=['post'], url_path='batch')
    def batch_create(self, request):
        """Create an entire false-positive group atomically."""

        batch = DuplicateBatchInputSerializer(data=request.data)
        batch.is_valid(raise_exception=True)
        requested_pairs = []
        pair_set = set()
        item_ids = set()
        for pair in batch.validated_data['pairs']:
            item_a_id, item_b_id = sorted((pair['item_a_id'], pair['item_b_id']))
            if item_a_id == item_b_id:
                raise serializers.ValidationError('Item-Paare müssen unterschiedlich sein.')
            normalized_pair = (item_a_id, item_b_id)
            if normalized_pair in pair_set:
                raise serializers.ValidationError('Ein Quarantäne-Paar wurde mehrfach übermittelt.')
            pair_set.add(normalized_pair)
            requested_pairs.append(normalized_pair)
            item_ids.update(normalized_pair)

        owned_items = Item.objects.filter(owner=request.user, pk__in=item_ids).in_bulk()
        if set(owned_items) != item_ids:
            raise serializers.ValidationError(
                'Quarantäne-Paare müssen vollständig zu deinem Konto gehören.'
            )

        existing_pairs = set(
            self.get_queryset().filter(
                is_active=True,
                item_a_id__in=item_ids,
                item_b_id__in=item_ids,
            ).values_list('item_a_id', 'item_b_id')
        )
        if pair_set & existing_pairs:
            raise serializers.ValidationError('Mindestens ein Quarantäne-Paar existiert bereits.')

        reason = batch.validated_data.get('reason', '')
        notes = batch.validated_data.get('notes', '')
        created = [
            DuplicateQuarantine(
                owner=request.user,
                item_a=owned_items[item_a_id],
                item_b=owned_items[item_b_id],
                reason=reason,
                notes=notes,
                is_active=True,
            )
            for item_a_id, item_b_id in requested_pairs
        ]
        try:
            with transaction.atomic():
                DuplicateQuarantine.objects.bulk_create(created)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                'Mindestens ein Quarantäne-Paar existiert bereits.'
            ) from exc
        return Response(self.get_serializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='batch-release')
    def batch_release(self, request):
        """Release a complete undo group atomically and owner-scoped."""

        batch = DuplicateBatchReleaseSerializer(data=request.data)
        batch.is_valid(raise_exception=True)
        entry_ids = set(batch.validated_data['ids'])
        with transaction.atomic():
            entries = self.get_queryset().select_for_update().filter(
                pk__in=entry_ids,
                is_active=True,
            )
            if entries.count() != len(entry_ids):
                raise serializers.ValidationError(
                    'Mindestens ein Quarantäne-Eintrag ist ungültig oder nicht mehr aktiv.'
                )
            entries.update(is_active=False, updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        instance = self.get_object()
        item_a_id, item_b_id = sorted((instance.item_a_id, instance.item_b_id))
        duplicate_exists = DuplicateQuarantine.objects.filter(
            owner=request.user,
            item_a_id=item_a_id,
            item_b_id=item_b_id,
            is_active=True,
        ).exclude(pk=instance.pk).exists()
        if duplicate_exists:
            return Response(
                {'detail': 'Dieses Quarantäne-Paar existiert bereits.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_fields = ['is_active', 'updated_at']
        if instance.item_a_id != item_a_id or instance.item_b_id != item_b_id:
            instance.item_a_id = item_a_id
            instance.item_b_id = item_b_id
            update_fields.extend(['item_a', 'item_b'])
        instance.is_active = True
        instance.save(update_fields=update_fields)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


__all__ = ['DuplicateQuarantineViewSet']
