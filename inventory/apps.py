from django.apps import AppConfig


class InventoryConfig(AppConfig):
    """
    App configuration for the inventory app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory'
    verbose_name = 'Inventarisierung'

    def ready(self):
        """
        Import signals when the app is ready.
        """
        from . import signals  # noqa: F401
