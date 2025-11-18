from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from inventory.models import Item, Tag, Location

User = get_user_model()

import shutil
import tempfile
from io import BytesIO
from unittest import mock

from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
import time
from contextlib import contextmanager

from ..models import Item, ItemImage, ItemList, Location, Tag, DuplicateQuarantine
from ..views import ItemImageViewSet

class TimedAPITestCase(APITestCase):

    @contextmanager
    def assertTiming(self, min_seconds):
        
        start = time.perf_counter()
        yield
        end = time.perf_counter()
        duration = end - start
        self.assertTrue(
            duration >= min_seconds,
            f"Operation took {duration:.4f}s, which is less than the minimum of {min_seconds}s."
        )

class BaseViewTestCase(TestCase):

    def setUp(self):
        
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _get_token(self, user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)

class LandingPageTests(TestCase):

    def test_landing_page_uses_configured_frontend_login_url(self):
        
        custom_url = 'https://app.example.com/login'
        with mock.patch.object(settings, 'FRONTEND_LOGIN_URL', custom_url):
            response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertIn(custom_url, response.content.decode('utf-8'))

class TagViewSetTests(APITestCase):

    def setUp(self):
        
        self.client = APIClient()
        self.user = User.objects.create_user('tagger', 'tagger@example.com', 'StrongPass123!')
        self.client.force_authenticate(user=self.user)

    def test_duplicate_name_returns_validation_error(self):
        
        url = reverse('tag-list')

        first_response = self.client.post(url, {'name': 'Office'}, format='json')
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        duplicate_response = self.client.post(url, {'name': 'Office'}, format='json')

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', duplicate_response.data)
        self.assertIn('existiert bereits', duplicate_response.data['name'][0])

class UserRegistrationViewSetTests(APITestCase):

    def test_registration_is_disabled(self):
        
        url = reverse('user-registration-list')
        payload = {
            'username': 'newmember',
            'email': 'newmember@example.com',
            'password': 'ValidPass123!',
            'password_confirm': 'ValidPass123!',
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['detail'], 'Registrierungen sind derzeit deaktiviert.')

class CustomTokenViewTests(APITestCase):

    def setUp(self):
        
        self.user = User.objects.create_user('tokenuser', 'tokenuser@example.com', 'StrongPass123!')

    def test_token_response_includes_user_payload(self):
        
        with mock.patch('rest_framework.views.APIView.get_throttles', return_value=[]):
            url = reverse('token_obtain_pair')
            payload = {'username': 'tokenuser', 'password': 'StrongPass123!'}

            response = self.client.post(url, payload, format='json')

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
            self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
            self.assertIn('user', response.data)
            self.assertEqual(response.data['user']['username'], 'tokenuser')
            self.assertEqual(response.data['user']['email'], 'tokenuser@example.com')

class LogoutViewTests(APITestCase):

    def setUp(self):
        
        self.user = User.objects.create_user('logoutuser', 'logout@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('otheruser', 'other@example.com', 'StrongPass123!')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_logout_with_missing_token_succeeds(self):
        
        url = reverse('logout')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_invalid_token_succeeds(self):
        
        url = reverse('logout')
        response = self.client.post(url, {'refresh': 'not-a-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_valid_token_succeeds(self):
        
        url = reverse('logout')
        refresh = RefreshToken.for_user(self.user)
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_other_users_token_returns_403(self):
        
        url = reverse('logout')
        refresh = RefreshToken.for_user(self.other_user)
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class ItemViewSetTests(APITestCase):

    def setUp(self):
        
        self.client = APIClient()
        self.user = User.objects.create_user('owner', 'owner@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('guest', 'guest@example.com', 'StrongPass123!')
        self.location = Location.objects.create(name='Closet', user=self.user)
        self.user_item = Item.objects.create(name='Printer', owner=self.user, location=self.location)
        Item.objects.create(name='Table', owner=self.other_user)

    def test_list_requires_authentication(self):
        
        url = reverse('item-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_user_items(self):
        
        url = reverse('item-list')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Printer')
        self.assertEqual(response.data['results'][0]['owner'], self.user.id)
        self.assertIsNone(response.data['results'][0]['wodis_inventory_number'])

    def test_create_item_assigns_owner(self):
        
        url = reverse('item-list')
        self.client.force_authenticate(user=self.user)
        payload = {
            'name': 'Scanner',
            'quantity': 1,
            'location': self.location.id,
            'wodis_inventory_number': 'W-2024-001',
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Scanner')
        self.assertEqual(response.data['owner'], self.user.id)
        self.assertEqual(response.data['wodis_inventory_number'], 'W-2024-001')
        self.assertTrue(Item.objects.filter(name='Scanner', owner=self.user).exists())

    def test_find_duplicates_returns_groups(self):
        
        duplicate_one = Item.objects.create(name='Printer', owner=self.user, location=self.location)
        duplicate_two = Item.objects.create(name='printer', owner=self.user, location=self.location)
        Item.objects.create(name='Unique', owner=self.user)

        url = reverse('item-find-duplicates')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url, {'name_match': 'exact'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)
        self.assertGreaterEqual(response.data['analyzed_count'], 3)
        first_group = response.data['results'][0]
        self.assertIn('match_reasons', first_group)
        item_ids = {item['id'] for item in first_group['items']}
        self.assertTrue({duplicate_one.id, duplicate_two.id}.issubset(item_ids))

    def test_find_duplicates_requires_active_criteria(self):
        
        url = reverse('item-find-duplicates')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            url,
            {
                'name_match': 'none',
                'description_match': 'none',
                'wodis_match': 'none',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_find_duplicates_auto_preset(self):
        
        Item.objects.create(name='Frank Haus', description='Bürostuhl Frank', owner=self.user, location=self.location)
        Item.objects.create(name='Frank Biel', description='Bürostuhl in Biel', owner=self.user, location=self.location)

        url = reverse('item-find-duplicates')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url, {'preset': 'auto'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['preset_used'], 'auto')
        self.assertGreater(response.data['count'], 0)

    def test_find_duplicates_ignores_quarantined_pairs(self):
        
        item_one = Item.objects.create(name='Chair Alpha', owner=self.user, location=self.location)
        item_two = Item.objects.create(name='Chair Alpha Copy', owner=self.user, location=self.location)
        DuplicateQuarantine.objects.create(owner=self.user, item_a=item_one, item_b=item_two)

        url = reverse('item-find-duplicates')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url, {'name_match': 'prefix'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

class ItemListViewSetTests(APITestCase):

    def setUp(self):
        
        self.client = APIClient()
        self.user = User.objects.create_user('collector', 'collector@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('visitor', 'visitor@example.com', 'StrongPass123!')
        self.user_item_one = Item.objects.create(name='Laptop', owner=self.user)
        self.user_item_two = Item.objects.create(name='Tablet', owner=self.user)
        self.other_item = Item.objects.create(name='Drill', owner=self.other_user)
        self.user_list = ItemList.objects.create(name='Office', owner=self.user)
        self.user_list.items.set([self.user_item_one])
        self.other_list = ItemList.objects.create(name='Workshop', owner=self.other_user)
        self.other_list.items.set([self.other_item])

    def test_list_requires_authentication(self):
        
        url = reverse('itemlist-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_user_lists(self):
        
        url = reverse('itemlist-list')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Office')
        self.assertEqual(response.data[0]['owner'], self.user.id)

    def test_create_list_assigns_owner_and_items(self):
        
        url = reverse('itemlist-list')
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Tech', 'items': [self.user_item_one.id, self.user_item_two.id]}

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Tech')
        self.assertEqual(response.data['owner'], self.user.id)
        item_list = ItemList.objects.get(id=response.data['id'])
        self.assertSetEqual(set(item_list.items.all()), {self.user_item_one, self.user_item_two})

    def test_create_rejects_other_users_items(self):
        
        url = reverse('itemlist-list')
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Invalid', 'items': [self.other_item.id]}

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', response.data)

    def test_update_replaces_items(self):
        
        url = reverse('itemlist-detail', args=[self.user_list.id])
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Office Updated', 'items': [self.user_item_two.id]}

        response = self.client.put(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_list.refresh_from_db()
        self.assertEqual(self.user_list.name, 'Office Updated')
        self.assertSetEqual(set(self.user_list.items.all()), {self.user_item_two})

    def test_cannot_access_other_users_list(self):
        
        url = reverse('itemlist-detail', args=[self.other_list.id])
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

class CurrentUserViewTests(APITestCase):

    def setUp(self):
        
        self.user = User.objects.create_user('profileuser', 'profile@example.com', 'StrongPass123!')

    def test_requires_authentication(self):
        
        url = reverse('current_user')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_current_user_payload(self):
        
        url = reverse('current_user')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['username'], 'profileuser')
        self.assertEqual(response.data['email'], 'profile@example.com')

class ItemImageViewSetTests(APITestCase):

    def setUp(self):
        
        self.temp_media = tempfile.mkdtemp()
        override = override_settings(MEDIA_ROOT=self.temp_media)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(lambda: shutil.rmtree(self.temp_media, ignore_errors=True))

        self.client = APIClient()
        self.user = User.objects.create_user('photographer', 'photo@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('viewer', 'viewer@example.com', 'StrongPass123!')
        self.item = Item.objects.create(name='Lens', owner=self.user)
        self.other_item = Item.objects.create(name='Tripod', owner=self.other_user)
        self.client.force_authenticate(user=self.user)

    def _image_file(self, name='test.png'):
        buffer = BytesIO()
        Image.new('RGB', (1, 1), color='white').save(buffer, format='PNG')
        buffer.seek(0)
        return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')

    def test_cannot_create_image_for_other_users_item(self):
        
        url = reverse('itemimage-list')
        payload = {'item': self.other_item.id, 'image': self._image_file()}

        response = self.client.post(url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('item', response.data)
        self.assertEqual(ItemImage.objects.count(), 0)

    def test_create_image_for_own_item(self):
        
        url = reverse('itemimage-list')
        payload = {'item': self.item.id, 'image': self._image_file('own.png')}

        response = self.client.post(url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ItemImage.objects.filter(item=self.item).count(), 1)

    def test_cannot_update_image_to_other_users_item(self):
        
        image = ItemImage.objects.create(item=self.item, image=self._image_file('original.png'))
        url = reverse('itemimage-detail', args=[image.id])

        response = self.client.patch(url, {'item': self.other_item.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        image.refresh_from_db()
        self.assertEqual(image.item, self.item)

    def test_perform_create_raises_permission_denied_for_foreign_item(self):
        
        view = ItemImageViewSet()
        factory = APIRequestFactory()
        request = factory.post(reverse('itemimage-list'), {'item': self.other_item.id})
        request.user = self.user
        view.request = request
        serializer = SimpleNamespace(validated_data={'item': self.other_item, 'image': self._image_file('unauthorized.png')})

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)

class UserScopedViewSetTests(APITestCase):

    def setUp(self):
        
        self.user1 = User.objects.create_user('user1', 'user1@example.com', 'password')
        self.user2 = User.objects.create_user('user2', 'user2@example.com', 'password')

        self.tag1 = Tag.objects.create(name='Tag 1', user=self.user1)
        self.location1 = Location.objects.create(name='Location 1', user=self.user1)

        self.tag2 = Tag.objects.create(name='Tag 2', user=self.user2)
        self.location2 = Location.objects.create(name='Location 2', user=self.user2)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def test_list_tags_returns_only_own_tags(self):
        
        url = reverse('tag-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], self.tag1.name)

    def test_cannot_retrieve_other_user_tag(self):
        
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_tag(self):
        
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.put(url, {'name': 'Updated Tag'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_tag(self):
        
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Tag.objects.filter(pk=self.tag2.id).exists())

    def test_list_locations_returns_only_own_locations(self):
        
        url = reverse('location-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], self.location1.name)

    def test_cannot_retrieve_other_user_location(self):
        
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_location(self):
        
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.put(url, {'name': 'Updated Location'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_location(self):
        
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Location.objects.filter(pk=self.location2.id).exists())

class ItemViewSetCustomActionsTests(APITestCase):

    def setUp(self):
        
        self.user1 = User.objects.create_user('user1', 'user1@example.com', 'password')
        self.user2 = User.objects.create_user('user2', 'user2@example.com', 'password')

        self.item1 = Item.objects.create(name='Item 1', owner=self.user1)
        self.item2 = Item.objects.create(name='Item 2', owner=self.user2)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def test_lookup_by_asset_tag_success(self):
        
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': self.item1.asset_tag})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.item1.name)

    def test_lookup_by_asset_tag_not_found(self):
        
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': self.item2.asset_tag})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_by_invalid_asset_tag(self):
        
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': 'invalid-uuid'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_qr_code_success(self):
        
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_generate_qr_code_for_other_user_item_not_found(self):
        
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item2.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_qr_code_download(self):
        
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
        response = self.client.get(url, {'download': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('attachment', response['Content-Disposition'])

    def test_generate_qr_code_not_available(self):
        
        with mock.patch.dict('sys.modules', {'qrcode': None}):
            url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

class AuthSecurityTests(TimedAPITestCase):

    def setUp(self):
        
        self.user = User.objects.create_user('auth_user', 'auth@example.com', 'password123')

    def test_login_with_nonexistent_email_is_slowed(self):
        
        url = reverse('token_obtain_pair')
        with self.assertLogs('security', level='WARNING') as cm:
            with self.assertTiming(min_seconds=0.1):
                response = self.client.post(url, {'email': 'nobody@example.com', 'password': 'password'})
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('Login attempt with non-existent email', cm.output[0])

    def test_login_with_wrong_password_is_slowed(self):
        
        url = reverse('token_obtain_pair')
        with self.assertTiming(min_seconds=0.15):
            response = self.client.post(url, {'email': self.user.email, 'password': 'wrong-password'})
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_obtains_new_access_token(self):

        login_url = reverse('token_obtain_pair')
        self.client.post(login_url, {'email': self.user.email, 'password': 'password123'})

        refresh_url = reverse('token_refresh')
        response = self.client.post(refresh_url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertTrue(response.data['rotated'])

    def test_remember_me_sets_long_lived_refresh_token(self):
        
        login_url = reverse('token_obtain_pair')
        response = self.client.post(login_url, {'email': self.user.email, 'password': 'password123', 'remember': True})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_cookie = response.cookies.get(settings.JWT_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(refresh_cookie)

        self.assertGreater(refresh_cookie['max-age'], 7 * 24 * 3600 - 10)

    @override_settings(JWT_COOKIE_SECURE=True, JWT_COOKIE_SAMESITE='None')
    def test_secure_cookies_are_set_correctly(self):
        
        login_url = reverse('token_obtain_pair')
        response = self.client.post(login_url, {'email': self.user.email, 'password': 'password123'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_cookie = response.cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
        self.assertTrue(access_cookie['secure'])
        self.assertEqual(access_cookie['samesite'], 'None')
        self.assertTrue(access_cookie['httponly'])
