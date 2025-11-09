"""
WSGI config for EmmaTresor project.

This module configures the WSGI (Web Server Gateway Interface) application
for the EmmaTresor Django project. WSGI is the standard Python web server interface
that enables communication between web servers and Python web applications.

The WSGI application is exposed as a module-level variable named ``application``
and can be used with WSGI-capable servers like Gunicorn, uWSGI, or mod_wsgi.

For more information on this file, see:
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/

Example usage with Gunicorn:
    gunicorn EmmaTresor.wsgi:application --bind 0.0.0.0:8000

Example usage with uWSGI:
    uwsgi --http :8000 --wsgi-file EmmaTresor/wsgi.py

Example usage with mod_wsgi (Apache):
    WSGIScriptAlias / /path/to/EmmaTresor/wsgi.py
"""

import os

from django.core.wsgi import get_wsgi_application

# Set the default Django settings module for the WSGI application
# This ensures Django knows which settings to use when the WSGI app starts
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

# Get the WSGI application using Django's helper function
# This returns a fully configured WSGI application instance
application = get_wsgi_application()
