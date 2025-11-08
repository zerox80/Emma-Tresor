"""
URL configuration for EmmaTresor project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
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
    path('admin/', admin.site.urls),
    # API endpoints for the inventory application
    path('api/', include('inventory.urls')),
    # Landing page route
    path('', LandingPageView.as_view(), name='home'),
]

# In development mode, serve media files through Django
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # In production, configure your web server (nginx, apache) to serve media files
    pass
