# ASGI Configuration for EmmaTresor
# =================================
# ASGI (Asynchronous Server Gateway Interface) is the modern interface between
# async web servers and Python web applications. This file enables support for
# asynchronous features like WebSockets, Server-Sent Events, and other real-time
# protocols in addition to standard HTTP requests.

import os                                         # Operating system interface for environment variables
from django.core.asgi import get_asgi_application  # Django's ASGI application factory

# Configure Django settings module
# ==============================
# Set the Django settings module to use for this ASGI application.
# This tells Django which settings.py file to load when running in async mode.
# setdefault() will only set the value if it's not already set, allowing
# environment variables to override this if needed.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmmaTresor.settings')

# Create the ASGI application
# ===========================
# This creates the ASGI application object that async web servers can use
# to communicate with the Django application. The returned application
# object implements the ASGI interface and can be served by any
# ASGI-compliant web server like Daphne, Uvicorn, or Hypercorn.
# This enables support for both synchronous HTTP requests and
# asynchronous protocols like WebSockets.
application = get_asgi_application()
