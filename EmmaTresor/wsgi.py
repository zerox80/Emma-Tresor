"""
WSGI config for EmmaTresor project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Set the default Django settings module for the WSGI application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

# Get the WSGI application using Django's helper
application = get_wsgi_application()
