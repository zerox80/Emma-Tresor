#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run Django administrative tasks.

    This function serves as the main entry point for Django's command-line
    management utility. It sets up the Django environment and delegates
    command execution to Django's built-in management system.

    The function handles Django import errors gracefully and provides helpful
    error messages if Django is not properly installed or the virtual
    environment is not activated.

    Raises:
        ImportError: If Django cannot be imported, indicating that Django
            is not installed or not available in the Python path.
    """
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
