# EmmaTresor URL Configuration
# ===========================
# This module defines the URL routing structure for the entire EmmaTresor application.
# It maps URL patterns to views and includes URL configurations from other apps.

from django.conf import settings                      # Django settings for accessing configuration
from django.conf.urls.static import static           # Serve static/media files in development
from django.contrib import admin                     # Django admin interface URLs
from django.urls import include, path                # URL routing functions
from .views import LandingPageView                   # Import the landing page view

# Main URL patterns for the application
# ====================================
# These patterns define how incoming HTTP requests are routed to views.
# The order matters - Django tries patterns in sequence.

urlpatterns = [
    # Django Admin Interface
    # =====================
    # Provides the built-in Django admin interface at /admin/
    # This is where administrators can manage users, groups, and database records
    path('admin/', admin.site.urls),

    # API Endpoints
    # =============
    # All REST API endpoints are prefixed with /api/
    # This includes authentication, inventory management, and other API functionality
    # The actual API routes are defined in inventory/urls.py
    path('api/', include('inventory.urls')),

    # Landing Page
    # ============
    # The root URL (/) serves the main landing page
    # This page typically redirects users to the frontend application
    path('', LandingPageView.as_view(), name='home')
]

# Development Static File Serving
# ==============================
# In development mode, Django can serve static and media files directly.
# In production, this should be handled by a proper web server like Nginx.
if settings.DEBUG:
    # Serve media files (user uploads) during development
    # MEDIA_URL is typically '/media/' and points to user-uploaded content
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # In production, static files are handled by the web server (Nginx)
    # No additional URL patterns needed
    pass
