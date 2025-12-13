# Django Application Configuration for Inventory App
# ==================================================
# This module configures the inventory application and sets up its integration
# with the Django project. It handles initialization tasks like registering
# signal handlers for automatic audit logging.

from django.apps import AppConfig  # Django application configuration base class

class InventoryConfig(AppConfig):
    """
    Configuration class for the inventory application.

    This class defines the application's metadata and handles initialization
    tasks that need to run when Django starts up.

    Attributes:
        default_auto_field: Type of auto-generated primary keys to use (BigAutoField for large ID ranges)
        name: Python import path to the application ('inventory')
        verbose_name: Human-readable name for the Django admin interface (German: "Inventarisierung")
    """

    # Use BigAutoField for primary keys (supports up to 2^63 - 1 IDs)
    # This is the default in Django 3.2+ and provides better scalability
    default_auto_field = 'django.db.models.BigAutoField'

    # Python path to the application package
    name = 'inventory'

    # German display name for the Django admin interface
    # "Inventarisierung" = "Inventory Management"
    verbose_name = 'Inventarisierung'

    def ready(self):
        """
        Perform initialization when Django starts.

        This method is called once when Django starts up. It's the place to:
        - Register signal handlers (for audit logging)
        - Import application-specific modules
        - Perform one-time setup tasks

        Signal Registration:
        - Importing signals.py registers the signal handlers for automatic change tracking
        - This enables audit logging for Item creation, updates, and deletion
        - Must be done in ready() to avoid circular import issues
        """
        # Import signals module to register signal handlers
        # This enables automatic audit logging for all Item changes
        from . import signals  # noqa: F401 (imported for side effects)
