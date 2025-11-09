# Inventory App URL Configuration
# ===============================
# This module defines all the API endpoints for the inventory management system.
# It includes authentication, CRUD operations for items, tags, locations, and file handling.

from django.urls import include, path                                    # URL routing functions
from rest_framework.routers import DefaultRouter                       # DRF router for ViewSets
from .views import (                                                   # Import all view classes
    CustomTokenObtainPairView, CustomTokenRefreshView, CurrentUserView,
    GetCSRFTokenView, ItemImageDownloadView, ItemImageViewSet,
    ItemListViewSet, ItemViewSet, LocationViewSet, LogoutView,
    TagViewSet, UserRegistrationViewSet
)

# Create a DRF router for handling ViewSet-based endpoints
# =======================================================
# The router automatically generates URL patterns for ViewSets including:
# - GET /endpoint/ - List all items
# - POST /endpoint/ - Create new item
# - GET /endpoint/{id}/ - Retrieve specific item
# - PUT/PATCH /endpoint/{id}/ - Update specific item
# - DELETE /endpoint/{id}/ - Delete specific item
router = DefaultRouter()

# Register ViewSets with the router
# ===============================
# Each registration creates a complete set of CRUD endpoints

# Tag management endpoints: /api/tags/
router.register('tags', TagViewSet, basename='tag')

# Location management endpoints: /api/locations/
router.register('locations', LocationViewSet, basename='location')

# Item management endpoints: /api/items/ (includes custom actions like export, QR generation)
router.register('items', ItemViewSet, basename='item')

# Item image management endpoints: /api/item-images/
router.register('item-images', ItemImageViewSet, basename='itemimage')

# Inventory list management endpoints: /api/lists/
router.register('lists', ItemListViewSet, basename='itemlist')

# User registration endpoint: /api/users/
router.register('users', UserRegistrationViewSet, basename='user-registration')

# Define explicit URL patterns for non-ViewSet views
# ================================================
# These are custom endpoints that don't fit the standard CRUD pattern

urlpatterns = [
    # CSRF Token endpoint
    # ==================
    # GET /api/csrf/ - Sets CSRF cookie for form security
    # Required for secure form submissions from the frontend
    path('csrf/', GetCSRFTokenView.as_view(), name='csrf_token'),

    # JWT Authentication endpoints
    # ===========================
    # POST /api/token/ - Exchange username/password for JWT tokens
    # Returns access and refresh tokens as HTTP-only cookies
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),

    # POST /api/token/refresh/ - Refresh access token using refresh token
    # Extends user session without requiring full re-authentication
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),

    # Current user information
    # =======================
    # GET /api/auth/me/ - Get current authenticated user details
    # Returns user ID, username, and email for the currently logged-in user
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),

    # Logout endpoint
    # ==============
    # POST /api/auth/logout/ - Logout user and invalidate tokens
    # Clears authentication cookies and blacklists refresh tokens
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    # Item image download endpoint
    # ==========================
    # GET /api/item-images/{id}/download/ - Download item image/file
    # Handles authenticated access to private media files with proper headers
    path('item-images/<int:pk>/download/', ItemImageDownloadView.as_view(), name='itemimage-download'),

    # Include all router-generated ViewSet URLs
    # ========================================
    # This includes all the CRUD endpoints for tags, locations, items, images, and lists
    # The empty prefix means these are available at /api/{endpoint}/
    path('', include(router.urls))
]
