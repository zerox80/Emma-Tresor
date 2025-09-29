from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable
import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.db.migrations.executor import MigrationExecutor
from django.db import connection

from .models import Item, ItemChangeLog

User = get_user_model()
logger = logging.getLogger(__name__)


def _is_migrating() -> bool:
    """Check if Django is currently running migrations"""
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        return len(plan) > 0
    except Exception:
        # If we can't determine, assume we're not migrating
        return False


def _safe_signal_handler(func):
    """Decorator to make signal handlers migration-safe"""
    def wrapper(*args, **kwargs):
        # Skip during migrations
        if _is_migrating():
            logger.debug(f"Skipping {func.__name__} during migration")
            return
            
        # Skip if ItemChangeLog table doesn't exist yet
        try:
            ItemChangeLog._meta.get_field('id')
        except Exception:
            logger.debug(f"Skipping {func.__name__} - ItemChangeLog table not ready")
            return
            
        # Execute with error handling
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in signal handler {func.__name__}: {e}")
            # Re-raise critical exceptions that should not be ignored
            if isinstance(e, (KeyboardInterrupt, SystemExit, MemoryError)):
                raise
            # Log and continue for other exceptions to avoid breaking main operation
            
    return wrapper


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
    if owner is not None:
        return owner
    return None


@receiver(pre_save, sender=Item)
@_safe_signal_handler
def _cache_previous_state(sender, instance: Item, **kwargs):
    if not instance.pk:
        instance._previous_state = None  # type: ignore[attr-defined]
        return
    try:
        previous = Item.objects.get(pk=instance.pk)
    except Item.DoesNotExist:
        instance._previous_state = None  # type: ignore[attr-defined]
    except Exception as e:
        logger.warning(f"Could not fetch previous state for Item {instance.pk}: {e}")
        instance._previous_state = None  # type: ignore[attr-defined]
    else:
        instance._previous_state = previous  # type: ignore[attr-defined]


@receiver(post_save, sender=Item)
@_safe_signal_handler
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
@_safe_signal_handler 
def _log_item_deletion(sender, instance: Item, **kwargs):
    user = _resolve_actor(instance)
    ItemChangeLog.objects.create(
        item=None,
        action='delete',
        user=user,
        item_name=getattr(instance, 'name', ''),
        changes={'deleted': True},
    )
