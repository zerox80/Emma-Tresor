from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from .views import LandingPageView
urlpatterns = [path('admin/', admin.site.urls), path('api/', include(
    'inventory.urls')), path('', LandingPageView.as_view(), name='home')]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
        )
else:
    pass
