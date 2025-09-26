from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Item, ItemChangeLog

User = get_user_model()


@dataclass
class ItemSnapshot:
    field: str
    old_value: Any
    new_value: Any


AUDITED_FIELDS: tuple[str, ...] = (
    'name',
    'description',
    'quantity',
    'purchase_date',
    'value',
    'location_id',
)


def _format_value(value: Any) -> Any:
    if isinstance(value, (int, float, str)) or value is None:
        return value
    if hasattr(value, 'pk'):
        return value.pk
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        return list(value)
    return str(value)


def _capture_changes(previous: Item, current: Item) -> list[ItemSnapshot]:
    diffs: list[ItemSnapshot] = []
    for field in AUDITED_FIELDS:
        old = getattr(previous, field)
        new = getattr(current, field)
        if old != new:
            diffs.append(ItemSnapshot(field=field, old_value=_format_value(old), new_value=_format_value(new)))
    return diffs


def _resolve_actor(instance: Item) -> User | None:
    owner = getattr(instance, 'owner', None)
    if owner is not None and getattr(owner, 'is_authenticated', False):
        return owner
    return None


@receiver(pre_save, sender=Item)
def _cache_previous_state(sender, instance: Item, **kwargs):
    if not instance.pk:
        instance._previous_state = None  # type: ignore[attr-defined]
        return
    try:
        previous = Item.objects.get(pk=instance.pk)
    except Item.DoesNotExist:
        instance._previous_state = None  # type: ignore[attr-defined]
    else:
        instance._previous_state = previous  # type: ignore[attr-defined]


@receiver(post_save, sender=Item)
def _log_item_changes(sender, instance: Item, created: bool, **kwargs):
    previous: Item | None = getattr(instance, '_previous_state', None)
    user = _resolve_actor(instance)

    if created:
        ItemChangeLog.objects.create(
            item=instance,
            action='create',
            user=user,
            item_name=instance.name,
            changes={'created': True},
        )
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    if previous is None:
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    changes = _capture_changes(previous, instance)
    if not changes:
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    ItemChangeLog.objects.create(
        item=instance,
        action='update',
        user=user,
        item_name=instance.name,
        changes={snapshot.field: {'old': snapshot.old_value, 'new': snapshot.new_value} for snapshot in changes},
    )
    if hasattr(instance, '_previous_state'):
        delattr(instance, '_previous_state')


@receiver(post_delete, sender=Item)
def _log_item_deletion(sender, instance: Item, **kwargs):
    user = _resolve_actor(instance)
    ItemChangeLog.objects.create(
        item=None,
        action='delete',
        user=user,
        item_name=getattr(instance, 'name', ''),
        changes={'deleted': True},
    )
