# Django Management Script
# =======================
# This is the command-line interface for managing the Django project.
# It provides access to Django's built-in management commands like:
# - runserver: Start the development server
# - migrate: Apply database migrations
# - createsuperuser: Create an admin user
# - collectstatic: Gather static files
# - test: Run the test suite

import os                 # Operating system interface for environment variables
import sys                # System-specific parameters and functions (command line arguments)

def main():
    """
    Main entry point for Django management commands.

    Sets up the Django environment and executes the requested management command.
    All Django management commands flow through this function.
    """
    # Set the Django settings module to use for this project
    # This tells Django which settings.py file to load
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

    try:
        # Import Django's command-line execution function
        # This handles parsing arguments and executing the appropriate management command
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # If Django can't be imported, provide a helpful error message
        # This usually means Django isn't installed or virtual environment isn't activated
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? Did you forget to activate a virtual environment?"
        ) from exc  # Preserve the original exception for debugging

    # Execute the management command with the provided command line arguments
    # sys.argv contains the command name and any additional arguments
    # Example: ['manage.py', 'runserver', '8000'] or ['manage.py', 'migrate']
    execute_from_command_line(sys.argv)

# Script execution guard
# =====================
# This ensures main() is only called when the script is executed directly,
# not when it's imported as a module into another Python file.
if __name__ == '__main__':
    main()
