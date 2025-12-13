# Django Signals for Audit Trail and Change Tracking
# ==================================================
# This module implements automatic audit logging for all Item model changes.
# It uses Django signals to capture create, update, and delete operations
# and stores them in the ItemChangeLog model for compliance and debugging.
#
# Key Features:
# - Automatic change tracking without modifying model code
# - Field-level change detection (old value vs new value)
# - User attribution for all changes
# - Thread-safe user deletion tracking
# - Migration-safe signal handlers (won't break during migrations)

from __future__ import annotations        # Enable forward references for type hints

from dataclasses import dataclass          # Data class for structured change snapshots
from typing import Any, Iterable           # Type hints for better code documentation
import logging                             # Logging framework for error handling
from threading import Lock                 # Thread synchronization for concurrent safety

from django.contrib.auth import get_user_model                      # Get User model
from django.db import transaction                                   # Database transactions
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save  # Django signals
from django.dispatch import receiver                                # Signal decorator
from django.db.migrations.executor import MigrationExecutor        # Migration detection
from django.db import connection                                    # Database connection

from .models import Item, ItemChangeLog    # Import models for signal handlers

# Get the configured User model (either Django's default or a custom one)
User = get_user_model()

# Logger for error and debug messages
logger = logging.getLogger(__name__)

# Thread-safe tracking of users being deleted
# ==========================================
# This prevents trying to log changes to items when the owning user is being deleted,
# which would cause database constraint errors.
_users_pending_deletion: set[int] = set()           # Set of user IDs currently being deleted
_users_pending_deletion_lock = Lock()                # Lock for thread-safe access to the set

def _is_migrating() -> bool:
    """
    Check if database migrations are currently running.

    This prevents signal handlers from executing during migrations, which could cause
    errors if the database schema isn't yet complete.

    Returns:
        bool: True if migrations are in progress, False otherwise
    """
    try:
        # Create migration executor to check for pending migrations
        executor = MigrationExecutor(connection)
        # Get the migration plan (list of migrations to apply)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        # If there are any migrations in the plan, we're migrating
        return len(plan) > 0
    except Exception:
        # If we can't determine migration status, assume we're not migrating
        # This is safer than blocking all signals on error
        return False

def _safe_signal_handler(func):
    """
    Decorator to make signal handlers safe during migrations and errors.

    This wrapper provides several safety features:
    1. Skips execution during database migrations
    2. Skips execution if ItemChangeLog table doesn't exist yet
    3. Catches and logs exceptions without breaking the application
    4. Re-raises critical exceptions (keyboard interrupt, system exit, memory error)

    Args:
        func: The signal handler function to wrap

    Returns:
        function: Wrapped signal handler with safety features
    """
    def wrapper(*args, **kwargs):
        # Safety check 1: Skip if migrations are running
        if _is_migrating():
            logger.debug(f"Skipping {func.__name__} during migration")
            return

        # Safety check 2: Skip if ItemChangeLog table doesn't exist yet
        # This can happen during initial migrations
        try:
            ItemChangeLog._meta.get_field('id')
        except Exception:
            logger.debug(f"Skipping {func.__name__} - ItemChangeLog table not ready")
            return

        # Execute the signal handler with error handling
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # Log the error for debugging
            logger.error(f"Error in signal handler {func.__name__}: {e}")

            # Re-raise critical exceptions that should stop execution
            if isinstance(e, (KeyboardInterrupt, SystemExit, MemoryError)):
                raise
            # For other exceptions, we log them but don't break the application

    return wrapper

# =========================
# DATA STRUCTURES
# =========================

@dataclass
class ItemSnapshot:
    """
    Data structure representing a single field change.

    Used to track before/after values for item field modifications.
    This allows detailed audit logging showing exactly what changed.

    Attributes:
        field: Name of the field that changed (e.g., 'name', 'quantity')
        old_value: The value before the change
        new_value: The value after the change
    """
    field: str           # Field name (e.g., 'name', 'quantity', 'value')
    old_value: Any       # Previous value before the change
    new_value: Any       # New value after the change

# Fields to track in the audit log
# ================================
# These are the Item model fields that will be monitored for changes
# Changes to these fields will be recorded in ItemChangeLog
AUDITED_FIELDS: tuple[str, ...] = (
    'name',              # Item name
    'description',       # Item description
    'quantity',          # Number of items
    'purchase_date',     # Date item was purchased
    'value',             # Monetary value
    'location_id',       # Foreign key to Location (tracked by ID not object)
)

# =========================
# HELPER FUNCTIONS
# =========================

def _format_value(value: Any) -> Any:
    """
    Format a value for JSON serialization in the change log.

    Converts complex objects to simple types that can be stored in JSON:
    - Primitives (int, float, str, None) are returned as-is
    - Django model instances are converted to their primary key
    - Iterables (except strings) are converted to lists
    - Everything else is converted to string

    Args:
        value: The value to format

    Returns:
        Any: JSON-serializable version of the value
    """
    # Primitives can be stored directly in JSON
    if isinstance(value, (int, float, str)) or value is None:
        return value
    # Django model instances - store their primary key
    if hasattr(value, 'pk'):
        return value.pk
    # Iterables (lists, sets, etc.) - convert to list
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        return list(value)
    # Fallback: convert to string representation
    return str(value)

def _capture_changes(previous: Item, current: Item) -> list[ItemSnapshot]:
    """
    Compare two Item instances and capture all field-level changes.

    Iterates through all audited fields and creates snapshots for any
    that have changed between the previous and current state.

    Args:
        previous: The Item instance before changes
        current: The Item instance after changes

    Returns:
        list[ItemSnapshot]: List of field changes (empty if nothing changed)
    """
    diffs: list[ItemSnapshot] = []
    # Compare each audited field
    for field in AUDITED_FIELDS:
        old = getattr(previous, field)
        new = getattr(current, field)
        # Only record if the value actually changed
        if old != new:
            diffs.append(ItemSnapshot(
                field=field,
                old_value=_format_value(old),
                new_value=_format_value(new)
            ))
    return diffs

def _resolve_actor(instance: Item) -> User | None:
    """
    Determine which user should be credited with an item change.

    Attempts to get the item's owner as the actor, but handles the case
    where the user is being deleted (which would cause errors).

    Args:
        instance: The Item instance being changed

    Returns:
        User | None: The user who made the change, or None if user is being deleted
    """
    # Get the owner of the item
    owner = getattr(instance, 'owner', None)
    if owner is not None:
        owner_id = getattr(owner, 'pk', None)
        if owner_id is not None:
            # Thread-safe check: is this user currently being deleted?
            with _users_pending_deletion_lock:
                if owner_id in _users_pending_deletion:
                    # User is being deleted - don't try to reference them
                    return None
        return owner
    return None

# =========================
# SIGNAL HANDLERS
# =========================
# These functions are automatically called when Item or User objects are saved/deleted

@receiver(pre_save, sender=Item)
@_safe_signal_handler
def _cache_previous_state(sender, instance: Item, **kwargs):
    """
    Signal handler: Cache the previous state of an Item before it's saved.

    This runs BEFORE save() is called on an Item. It loads the existing version
    from the database and stores it on the instance for comparison after save.

    This two-step process (pre_save + post_save) allows us to detect exactly
    what changed during an update operation.

    Args:
        sender: The model class (Item)
        instance: The Item instance being saved
        **kwargs: Additional signal arguments
    """
    # If this is a new item (no primary key yet), there's no previous state
    if not instance.pk:
        instance._previous_state = None
        return

    try:
        # Load the current state from database before changes are saved
        previous = Item.objects.get(pk=instance.pk)
    except Item.DoesNotExist:
        # Item was deleted between check and save (rare edge case)
        instance._previous_state = None
    except Exception as e:
        # Database error or other unexpected issue
        logger.warning(f"Could not fetch previous state for Item {instance.pk}: {e}")
        instance._previous_state = None
    else:
        # Successfully loaded - store for comparison in post_save
        instance._previous_state = previous

@receiver(post_save, sender=Item)
@_safe_signal_handler
def _log_item_changes(sender, instance: Item, created: bool, **kwargs):
    """
    Signal handler: Log item creation or updates to the audit trail.

    This runs AFTER save() completes. It compares the previous state (cached
    in pre_save) with the current state and creates a change log entry.

    For new items: Creates a 'create' log entry
    For updates: Creates an 'update' log entry with field-level changes

    Args:
        sender: The model class (Item)
        instance: The Item instance that was saved
        created: True if this is a new item, False if it's an update
        **kwargs: Additional signal arguments
    """
    # Get the previous state that was cached in pre_save
    previous: Item | None = getattr(instance, '_previous_state', None)
    # Determine which user made the change
    user = _resolve_actor(instance)

    # Handle new item creation
    if created:
        ItemChangeLog.objects.create(
            item=instance,
            action='create',
            user=user,
            item_name=instance.name,
            changes={'created': True},
        )
        # Clean up the cached previous state
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    # Handle updates: if we don't have a previous state, we can't log changes
    if previous is None:
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    # Compare previous and current state to find what changed
    changes = _capture_changes(previous, instance)

    # If nothing actually changed, don't create a log entry
    if not changes:
        if hasattr(instance, '_previous_state'):
            delattr(instance, '_previous_state')
        return

    # Create change log entry with field-level details
    ItemChangeLog.objects.create(
        item=instance,
        action='update',
        user=user,
        item_name=instance.name,
        # Convert list of snapshots to dict format: {field: {old: ..., new: ...}}
        changes={snapshot.field: {'old': snapshot.old_value, 'new': snapshot.new_value} for snapshot in changes},
    )

    # Clean up the cached previous state
    if hasattr(instance, '_previous_state'):
        delattr(instance, '_previous_state')

@receiver(post_delete, sender=Item)
@_safe_signal_handler
def _log_item_deletion(sender, instance: Item, **kwargs):
    """
    Signal handler: Log item deletion to the audit trail.

    This runs AFTER an Item is deleted from the database. It creates a
    change log entry to record the deletion. Note that the foreign key
    to the deleted item is set to None, but we preserve the item name
    for historical records.

    Args:
        sender: The model class (Item)
        instance: The Item instance that was deleted
        **kwargs: Additional signal arguments
    """
    # Determine which user deleted the item
    user = _resolve_actor(instance)

    # Create deletion log entry
    # Note: item=None because the item no longer exists
    ItemChangeLog.objects.create(
        item=None,                                    # Item is deleted, can't reference it
        action='delete',
        user=user,
        item_name=getattr(instance, 'name', ''),      # Preserve name for audit trail
        changes={'deleted': True},
    )

# =========================
# USER DELETION TRACKING
# =========================
# These handlers prevent errors when users are deleted while their items exist

@receiver(pre_delete, sender=User)
def _mark_user_for_deletion(sender, instance: User, **kwargs):
    """
    Signal handler: Mark user as pending deletion.

    This runs BEFORE a User is deleted. It adds the user's ID to a tracking
    set so that item change logs won't try to reference this user during
    the cascade deletion of their items.

    Args:
        sender: The User model class
        instance: The User instance being deleted
        **kwargs: Additional signal arguments
    """
    if instance.pk is not None:
        # Thread-safe addition to the pending deletion set
        with _users_pending_deletion_lock:
            _users_pending_deletion.add(instance.pk)

@receiver(post_delete, sender=User)
def _unmark_user_for_deletion(sender, instance: User, **kwargs):
    """
    Signal handler: Remove user from pending deletion tracking.

    This runs AFTER a User is deleted. It removes the user's ID from the
    tracking set to clean up memory and prevent false positives.

    Args:
        sender: The User model class
        instance: The User instance that was deleted
        **kwargs: Additional signal arguments
    """
    if instance.pk is not None:
        # Thread-safe removal from the pending deletion set
        with _users_pending_deletion_lock:
            _users_pending_deletion.discard(instance.pk)
