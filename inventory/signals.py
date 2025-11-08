from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable
import logging
from threading import Lock

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver
from django.db.migrations.executor import MigrationExecutor
from django.db import connection

from .models import Item, ItemChangeLog

User = get_user_model()
logger = logging.getLogger(__name__)

_users_pending_deletion: set[int] = set()
_users_pending_deletion_lock = Lock()


def _is_migrating() -> bool:
    """
    Checks if Django is currently running migrations.

    Returns:
        bool: True if migrations are running, False otherwise.
    """
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        return len(plan) > 0
    except Exception:
        # If we can't determine, assume we're not migrating
        return False


def _safe_signal_handler(func):
    """
    Decorator to make signal handlers migration-safe.

    This decorator ensures that the decorated signal handler function is
    not executed during migrations or if the ItemChangeLog table is not
    yet available. It also includes error handling to prevent signal
    handler failures from breaking the main operation.

    Args:
        func (callable): The signal handler function to wrap.

    Returns:
        callable: The wrapped function.
    """
    def wrapper(*args, **kwargs):
        """Wrap a signal handler to skip migrations and swallow safe errors.

        Args:
            *args: Positional arguments forwarded to the wrapped handler.
            **kwargs: Keyword arguments forwarded to the wrapped handler.

        Returns:
            Any | None: The handler's return value when executed, otherwise None.
        """
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
    """Represents a snapshot of a single field change for an item.

    Attributes:
        field (str): The name of the field that was changed.
        old_value (Any): The value of the field before the change.
        new_value (Any): The value of the field after the change.
    """
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
    """
    Formats a value for serialization in the change log.

    Args:
        value: The value to format.

    Returns:
        The formatted value.
    """
    if isinstance(value, (int, float, str)) or value is None:
        return value
    if hasattr(value, 'pk'):
        return value.pk
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        return list(value)
    return str(value)


def _capture_changes(previous: Item, current: Item) -> list[ItemSnapshot]:
    """
    Captures the changes between two versions of an item.

    Args:
        previous: The previous state of the item.
        current: The current state of the item.

    Returns:
        A list of ItemSnapshot objects representing the changes.
    """
    diffs: list[ItemSnapshot] = []
    for field in AUDITED_FIELDS:
        old = getattr(previous, field)
        new = getattr(current, field)
        if old != new:
            diffs.append(ItemSnapshot(field=field, old_value=_format_value(old), new_value=_format_value(new)))
    return diffs


def _resolve_actor(instance: Item) -> User | None:
    """
    Resolves the user responsible for a change.

    Args:
        instance: The item instance.

    Returns:
        The user responsible for the change, or None if the user is being deleted.
    """
    owner = getattr(instance, 'owner', None)
    if owner is not None:
        owner_id = getattr(owner, 'pk', None)
        if owner_id is not None:
            with _users_pending_deletion_lock:
                if owner_id in _users_pending_deletion:
                    return None
        return owner
    return None


@receiver(pre_save, sender=Item)
@_safe_signal_handler
def _cache_previous_state(sender, instance: Item, **kwargs):
    """Caches the previous state of an item before it is saved.

    This function is a signal handler that is called before an `Item`
    instance is saved. It fetches the current state of the item from the
    database and stores it on the instance, so that it can be compared
    to the new state after the save is complete.

    Args:
        sender (type): The model class that sent the signal.
        instance (Item): The instance of the model that is being saved.
        **kwargs: Additional keyword arguments.
    """
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
    """Logs changes made to an item after it is saved.

    This function is a signal handler that is called after an `Item`
    instance is saved. It compares the new state of the item to the
    previous state (which was cached by `_cache_previous_state`) and
    creates an `ItemChangeLog` entry if there are any differences.

    Args:
        sender (type): The model class that sent the signal.
        instance (Item): The instance of the model that was saved.
        created (bool): A boolean indicating whether the instance was
            created or updated.
        **kwargs: Additional keyword arguments.
    """
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
    """Logs the deletion of an item.

    This function is a signal handler that is called after an `Item`
    instance is deleted. It creates an `ItemChangeLog` entry to record
    the deletion.

    Args:
        sender (type): The model class that sent the signal.
        instance (Item): The instance of the model that was deleted.
        **kwargs: Additional keyword arguments.
    """
    user = _resolve_actor(instance)
    ItemChangeLog.objects.create(
        item=None,
        action='delete',
        user=user,
        item_name=getattr(instance, 'name', ''),
        changes={'deleted': True},
    )


@receiver(pre_delete, sender=User)
def _mark_user_for_deletion(sender, instance: User, **kwargs):
    """Marks a user for deletion before they are deleted.

    This function is a signal handler that is called before a `User`
    instance is deleted. It adds the user's ID to a global set of users
    that are pending deletion. This is used to prevent the item change
    log from trying to associate a deleted user with a change.

    Args:
        sender (type): The model class that sent the signal.
        instance (User): The instance of the model that is being deleted.
        **kwargs: Additional keyword arguments.
    """
    if instance.pk is not None:
        with _users_pending_deletion_lock:
            _users_pending_deletion.add(instance.pk)


@receiver(post_delete, sender=User)
def _unmark_user_for_deletion(sender, instance: User, **kwargs):
    """Unmarks a user for deletion after they have been deleted.

    This function is a signal handler that is called after a `User`
    instance is deleted. It removes the user's ID from the global set of
    users that are pending deletion.

    Args:
        sender (type): The model class that sent the signal.
        instance (User): The instance of the model that was deleted.
        **kwargs: Additional keyword arguments.
    """
    if instance.pk is not None:
        with _users_pending_deletion_lock:
            _users_pending_deletion.discard(instance.pk)
