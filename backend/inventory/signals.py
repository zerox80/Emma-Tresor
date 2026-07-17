"""Fail-closed, model-level audit logging for inventory changes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from django.contrib.auth import get_user_model
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver

from .audit import get_audit_actor, tag_audit_is_suppressed
from .models import Item, ItemChangeLog, ItemImage, Location, Tag


User = get_user_model()


@dataclass
class ItemSnapshot:
    field: str
    old_value: Any
    new_value: Any


AUDITED_FIELDS: tuple[str, ...] = (
    'name', 'description', 'quantity', 'purchase_date', 'value',
    'owner_id', 'location_id', 'wodis_inventory_number', 'employee_name', 'room_number',
)


def _format_value(value: Any) -> Any:
    if isinstance(value, (int, float, str)) or value is None:
        return value
    if hasattr(value, 'pk'):
        return value.pk
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        return list(value)
    return str(value)


def _capture_changes(
    previous: Item,
    current: Item,
    update_fields: frozenset[str] | None = None,
) -> list[ItemSnapshot]:
    audited_fields = AUDITED_FIELDS
    if update_fields is not None:
        audited_fields = tuple(
            field
            for field in AUDITED_FIELDS
            if field in update_fields or field.removesuffix('_id') in update_fields
        )
    return [
        ItemSnapshot(field, _format_value(getattr(previous, field)), _format_value(getattr(current, field)))
        for field in audited_fields
        if getattr(previous, field) != getattr(current, field)
    ]


def _resolve_actor():
    actor = get_audit_actor()
    actor_id = getattr(actor, 'pk', None)
    if actor_id is not None and getattr(actor, 'is_authenticated', False):
        return actor
    return None


def _deletion_started_by(origin, model) -> bool:
    """Return whether a delete cascade originated from a model instance/queryset."""

    return isinstance(origin, model) or getattr(origin, 'model', None) is model


def _write_update(item: Item, changes: dict) -> None:
    ItemChangeLog.objects.create(
        item=item,
        action=ItemChangeLog.ACTION_UPDATE,
        user=_resolve_actor(),
        item_name=item.name,
        changes=changes,
    )


@receiver(pre_save, sender=Item)
def _cache_previous_state(sender, instance: Item, **kwargs):
    if not instance.pk:
        instance._previous_state = None
        return
    try:
        instance._previous_state = Item.objects.get(pk=instance.pk)
    except Item.DoesNotExist:
        instance._previous_state = None


@receiver(post_save, sender=Item)
def _log_item_changes(sender, instance: Item, created: bool, **kwargs):
    previous = getattr(instance, '_previous_state', None)
    if created:
        ItemChangeLog.objects.create(
            item=instance,
            action=ItemChangeLog.ACTION_CREATE,
            user=_resolve_actor(),
            item_name=instance.name,
            changes={'created': True},
        )
    elif previous is not None:
        snapshots = _capture_changes(previous, instance, kwargs.get('update_fields'))
        if snapshots:
            _write_update(instance, {
                change.field: {'old': change.old_value, 'new': change.new_value}
                for change in snapshots
            })
    if hasattr(instance, '_previous_state'):
        delattr(instance, '_previous_state')


@receiver(post_delete, sender=Item)
def _log_item_deletion(sender, instance: Item, origin=None, **kwargs):
    ItemChangeLog.objects.create(
        item=None,
        action=ItemChangeLog.ACTION_DELETE,
        # Do not create a fresh FK to a user that the same Collector is about
        # to delete; Django cannot discover new related rows mid-cascade.
        user=None if _deletion_started_by(origin, User) else _resolve_actor(),
        item_name=instance.name,
        changes={'deleted': True},
    )


@receiver(m2m_changed, sender=Item.tags.through)
def _log_tag_changes(sender, instance, action: str, reverse: bool, pk_set=None, **kwargs):
    if tag_audit_is_suppressed():
        return

    if reverse:
        _log_reverse_tag_changes(instance, action, pk_set)
        return

    if not isinstance(instance, Item):
        return
    if action.startswith('pre_'):
        instance._previous_tag_ids = sorted(instance.tags.values_list('id', flat=True))
        return
    if not action.startswith('post_'):
        return
    previous = getattr(instance, '_previous_tag_ids', None)
    current = sorted(instance.tags.values_list('id', flat=True))
    if previous is not None and previous != current:
        _write_update(instance, {'tags': {'old': previous, 'new': current}})
    if hasattr(instance, '_previous_tag_ids'):
        delattr(instance, '_previous_tag_ids')


def _log_reverse_tag_changes(tag, action: str, pk_set) -> None:
    """Audit changes made through ``tag.items`` as well as ``item.tags``."""

    if action.startswith('pre_'):
        affected_items = (
            tag.items.all()
            if action == 'pre_clear'
            else Item.objects.filter(pk__in=pk_set or ())
        )
        tag._previous_item_tags = {
            item.pk: sorted(item.tags.values_list('id', flat=True))
            for item in affected_items
        }
        return
    if not action.startswith('post_'):
        return

    previous_by_item = getattr(tag, '_previous_item_tags', {})
    for item in Item.objects.filter(pk__in=previous_by_item).select_related('owner'):
        previous = previous_by_item[item.pk]
        current = sorted(item.tags.values_list('id', flat=True))
        if previous != current:
            _write_update(item, {'tags': {'old': previous, 'new': current}})
    if hasattr(tag, '_previous_item_tags'):
        delattr(tag, '_previous_item_tags')


@receiver(pre_delete, sender=Tag)
def _log_tag_deletion(sender, instance: Tag, origin=None, **kwargs):
    """Record relation changes that Django's delete collector applies directly."""

    if _deletion_started_by(origin, User):
        return
    items = instance.items.select_related('owner').prefetch_related('tags')
    for item in items:
        previous = sorted(tag.pk for tag in item.tags.all())
        current = [tag_id for tag_id in previous if tag_id != instance.pk]
        if previous != current:
            _write_update(item, {'tags': {'old': previous, 'new': current}})


@receiver(pre_delete, sender=Location)
def _log_location_deletion(sender, instance: Location, origin=None, **kwargs):
    """Audit implicit ``SET_NULL`` item updates caused by location deletion."""

    if _deletion_started_by(origin, User):
        return
    for item in instance.items.select_related('owner'):
        _write_update(item, {
            'location_id': {'old': instance.pk, 'new': None},
        })


@receiver(pre_save, sender=ItemImage)
def _cache_previous_image(sender, instance: ItemImage, **kwargs):
    if not instance.pk:
        instance._previous_image_state = None
        return
    try:
        instance._previous_image_state = ItemImage.objects.values_list('item_id', 'image').get(pk=instance.pk)
    except ItemImage.DoesNotExist:
        instance._previous_image_state = None


@receiver(post_save, sender=ItemImage)
def _log_image_save(sender, instance: ItemImage, created: bool, **kwargs):
    previous_state = getattr(instance, '_previous_image_state', None)
    current_item_id = instance.item_id
    current_name = instance.image.name
    update_fields = kwargs.get('update_fields')
    if previous_state is not None and update_fields is not None:
        previous_item_id, previous_name = previous_state
        if 'item' not in update_fields and 'item_id' not in update_fields:
            current_item_id = previous_item_id
        if 'image' not in update_fields:
            current_name = previous_name

    if created:
        _write_update(instance.item, {
            'images': {
                'action': 'create',
                'id': instance.pk,
                'old': None,
                'new': current_name,
            }
        })
    elif previous_state is not None:
        previous_item_id, previous_name = previous_state
        if previous_item_id != current_item_id:
            previous_item = Item.objects.get(pk=previous_item_id)
            current_item = Item.objects.get(pk=current_item_id)
            _write_update(previous_item, {
                'images': {'action': 'detach', 'id': instance.pk, 'old': previous_name, 'new': None}
            })
            _write_update(current_item, {
                'images': {'action': 'attach', 'id': instance.pk, 'old': None, 'new': current_name}
            })
        elif previous_name != current_name:
            current_item = Item.objects.get(pk=current_item_id)
            _write_update(current_item, {
                'images': {'action': 'update', 'id': instance.pk, 'old': previous_name, 'new': current_name}
            })
    if hasattr(instance, '_previous_image_state'):
        delattr(instance, '_previous_image_state')


@receiver(post_delete, sender=ItemImage)
def _log_image_delete(sender, instance: ItemImage, origin=None, **kwargs):
    if _deletion_started_by(origin, Item) or _deletion_started_by(origin, User):
        return
    _write_update(instance.item, {
        'images': {'action': 'delete', 'id': instance.pk, 'old': instance.image.name, 'new': None}
    })
