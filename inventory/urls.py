"""
URL configuration for the inventory app.

This module defines the URL patterns for the inventory Django REST Framework API.
It includes endpoints for authentication, item management, image handling,
and user-defined features like tags and locations.

URL patterns are organized into logical groups:
- Authentication: CSRF tokens, JWT tokens, user management
- Core resources: Items, images, tags, locations, lists
- File handling: Image downloads with proper access control

All API endpoints are prefixed with '/api/' from the main project URLs.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    CurrentUserView,
    GetCSRFTokenView,
    ItemImageDownloadView,
    ItemImageViewSet,
    ItemListViewSet,
    ItemViewSet,
    LocationViewSet,
    LogoutView,
    TagViewSet,
    UserRegistrationViewSet,
)

# Create a router and register all viewsets
router = DefaultRouter()
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'item-images', ItemImageViewSet, basename='itemimage')
router.register(r'lists', ItemListViewSet, basename='itemlist')
router.register(r'users', UserRegistrationViewSet, basename='user-registration')

# Define URL patterns for the inventory API
urlpatterns = [
    # CSRF token endpoint
    path('csrf/', GetCSRFTokenView.as_view(), name='csrf_token'),
    # JWT token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    # User authentication endpoints
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    # Item image download endpoint
    path('item-images/<int:pk>/download/', ItemImageDownloadView.as_view(), name='itemimage-download'),
    # Include all router URLs
    path('', include(router.urls)),
]
