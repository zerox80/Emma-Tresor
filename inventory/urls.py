from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView, CustomTokenRefreshView, CurrentUserView, GetCSRFTokenView, ItemImageDownloadView, ItemImageViewSet, ItemListViewSet, ItemViewSet, LocationViewSet, LogoutView, TagViewSet, UserRegistrationViewSet
router = DefaultRouter()
router.register('tags', TagViewSet, basename='tag')
router.register('locations', LocationViewSet, basename='location')
router.register('items', ItemViewSet, basename='item')
router.register('item-images', ItemImageViewSet, basename='itemimage')
router.register('lists', ItemListViewSet, basename='itemlist')
router.register('users', UserRegistrationViewSet, basename='user-registration')
urlpatterns = [path('csrf/', GetCSRFTokenView.as_view(), name='csrf_token'),
    path('token/', CustomTokenObtainPairView.as_view(), name=
    'token_obtain_pair'), path('token/refresh/', CustomTokenRefreshView.
    as_view(), name='token_refresh'), path('auth/me/', CurrentUserView.
    as_view(), name='current_user'), path('auth/logout/', LogoutView.
    as_view(), name='logout'), path('item-images/<int:pk>/download/',
    ItemImageDownloadView.as_view(), name='itemimage-download'), path('',
    include(router.urls))]
