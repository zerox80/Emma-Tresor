"""
ASGI config for EmmaTresor project.

This module configures the ASGI (Asynchronous Server Gateway Interface) application
for the EmmaTresor Django project. ASGI is a modern Python web server interface
that supports asynchronous request handling, enabling features like WebSockets,
HTTP/2, and other asynchronous protocols.

The ASGI application is exposed as a module-level variable named ``application``
and can be used with ASGI-capable servers like Daphne, Uvicorn, or Hypercorn.

For more information on this file, see:
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/

Example usage with Daphne:
    daphne EmmaTresor.asgi:application -p 8000

Example usage with Uvicorn:
    uvicorn EmmaTresor.asgi:application --host 0.0.0.0 --port 8000
"""

import os

from django.core.asgi import get_asgi_application

# Set the default Django settings module for the ASGI application
# This ensures Django knows which settings to use when the ASGI app starts
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

# Get the ASGI application using Django's helper function
# This returns a fully configured ASGI application instance
application = get_asgi_application()
