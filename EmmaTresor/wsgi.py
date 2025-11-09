# WSGI Configuration for EmmaTresor
# =================================
# WSGI (Web Server Gateway Interface) is the standard interface between
# web servers and Python web applications. This file is used by production
# web servers like Gunicorn, uWSGI, or Apache with mod_wsgi to serve the
# Django application in a production environment.

import os                                         # Operating system interface for environment variables
from django.core.wsgi import get_wsgi_application  # Django's WSGI application factory

# Configure Django settings module
# ==============================
# Set the Django settings module to use for this WSGI application.
# This tells Django which settings.py file to load when running in production.
# setdefault() will only set the value if it's not already set, allowing
# environment variables to override this if needed.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

# Create the WSGI application
# ===========================
# This creates the WSGI application object that web servers can use
# to communicate with the Django application. The returned application
# object implements the WSGI interface and can be served by any
# WSGI-compliant web server.
application = get_wsgi_application()
