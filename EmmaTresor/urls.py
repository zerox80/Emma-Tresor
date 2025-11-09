"""
URL configuration for EmmaTresor project.

This module defines the URL patterns for the EmmaTresor Django project.
The `urlpatterns` list routes URLs to appropriate views and includes
URL configurations from other Django applications.

For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/

URL patterns defined:
- admin/          : Django admin interface
- api/            : API endpoints for the inventory application
- '' (root)       : Landing page

Example URL routing patterns:
Function views:
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
    
Class-based views:
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
    
Including another URLconf:
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from .views import LandingPageView

# URL patterns for the EmmaTresor project
urlpatterns = [
    # Django admin interface
    # Provides the built-in Django admin panel for managing application data
    path('admin/', admin.site.urls),
    
    # API endpoints for the inventory application
    # Routes all API requests to the inventory app's URL configuration
    path('api/', include('inventory.urls')),
    
    # Landing page route
    # Serves the main landing page of the application
    path('', LandingPageView.as_view(), name='home'),
]

# In development mode, serve media files through Django
# In production, configure your web server (nginx, apache) to serve media files
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Production environments should use a dedicated web server for static files
    # to improve performance and security
    pass
