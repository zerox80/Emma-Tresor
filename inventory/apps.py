from django.apps import AppConfig


class InventoryConfig(AppConfig):
    """App configuration for the inventory app.

    Configures the Django inventory application with German verbose names
    and sets up signal handlers when the app is ready.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory'
    verbose_name = 'Inventarisierung'

    def ready(self):
        """Initialize the app when Django starts.

        This method is called when the application is ready. It imports
        the signals module to register signal handlers for tracking
        changes to inventory items.
        """
        from . import signals  # noqa: F401
