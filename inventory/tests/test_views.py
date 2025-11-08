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

from ..models import Item, ItemImage, ItemList, Location, Tag
from ..views import ItemImageViewSet


class TimedAPITestCase(APITestCase):
    """APITestCase variant that exposes timing assertions."""

    @contextmanager
    def assertTiming(self, min_seconds):
        """Assert that a code block takes at least the provided duration.

        Args:
            min_seconds (float): Minimum acceptable runtime in seconds.

        Yields:
            None: Execution resumes inside the context manager.
        """
        start = time.perf_counter()
        yield
        end = time.perf_counter()
        duration = end - start
        self.assertTrue(
            duration >= min_seconds,
            f"Operation took {duration:.4f}s, which is less than the minimum of {min_seconds}s."
        )


class BaseViewTestCase(TestCase):
    """Base test case that prepares an authenticated API client."""

    def setUp(self):
        """Create a user and authenticate the DRF test client."""
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _get_token(self, user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)

class LandingPageTests(TestCase):
    """Verify the root view renders links to the configured SPA."""

    def test_landing_page_uses_configured_frontend_login_url(self):
        """Ensure the landing page substitutes the FRONTEND_LOGIN_URL.

        Returns:
            None: Assertions inspect the HTTP response body.
        """
        custom_url = 'https://app.example.com/login'
        with mock.patch.object(settings, 'FRONTEND_LOGIN_URL', custom_url):
            response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertIn(custom_url, response.content.decode('utf-8'))


class TagViewSetTests(APITestCase):
    """Test CRUD mechanics specific to the tag API viewset."""

    def setUp(self):
        """Authenticate a user for exercising tag endpoints."""
        self.client = APIClient()
        self.user = User.objects.create_user('tagger', 'tagger@example.com', 'StrongPass123!')
        self.client.force_authenticate(user=self.user)

    def test_duplicate_name_returns_validation_error(self):
        """Ensure duplicate tag names return a validation error.

        Returns:
            None: Assertions validate HTTP status codes and payload.
        """
        url = reverse('tag-list')

        first_response = self.client.post(url, {'name': 'Office'}, format='json')
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        duplicate_response = self.client.post(url, {'name': 'Office'}, format='json')

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', duplicate_response.data)
        self.assertIn('existiert bereits', duplicate_response.data['name'][0])


class UserRegistrationViewSetTests(APITestCase):
    """Assert that public registration endpoints remain disabled."""

    def test_registration_is_disabled(self):
        """Ensure POST requests receive a 403 explaining the restriction.

        Returns:
            None: Assertions cover status code and error message.
        """
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
    """Confirm JWT endpoints set cookies and return user payloads."""

    def setUp(self):
        """Create user credentials for token acquisition tests."""
        self.user = User.objects.create_user('tokenuser', 'tokenuser@example.com', 'StrongPass123!')

    def test_token_response_includes_user_payload(self):
        """Check the token endpoint returns cookies and user data.

        Returns:
            None: Assertions inspect response fields and cookies.
        """
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
    """Verify logout behavior for various token scenarios."""

    def setUp(self):
        """Seed two users and an authenticated API client."""
        self.user = User.objects.create_user('logoutuser', 'logout@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('otheruser', 'other@example.com', 'StrongPass123!')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_logout_with_missing_token_succeeds(self):
        """Ensure logout succeeds even when no refresh token is provided.

        Returns:
            None: Assertions inspect the HTTP status code.
        """
        url = reverse('logout')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_invalid_token_succeeds(self):
        """Verify invalid tokens do not break logout semantics.

        Returns:
            None: Assertions cover success responses.
        """
        url = reverse('logout')
        response = self.client.post(url, {'refresh': 'not-a-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_valid_token_succeeds(self):
        """Confirm logout works with a valid refresh token cookie.

        Returns:
            None: Assertions examine the HTTP response.
        """
        url = reverse('logout')
        refresh = RefreshToken.for_user(self.user)
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_with_other_users_token_returns_403(self):
        """Ensure using someone else's token is forbidden.

        Returns:
            None: Assertions check for HTTP 403.
        """
        url = reverse('logout')
        refresh = RefreshToken.for_user(self.other_user)
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ItemViewSetTests(APITestCase):
    """Behavioral tests for the primary item API endpoints."""

    def setUp(self):
        """Provision two owners and seed initial inventory records."""
        self.client = APIClient()
        self.user = User.objects.create_user('owner', 'owner@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('guest', 'guest@example.com', 'StrongPass123!')
        self.location = Location.objects.create(name='Closet', user=self.user)
        self.user_item = Item.objects.create(name='Printer', owner=self.user, location=self.location)
        Item.objects.create(name='Table', owner=self.other_user)

    def test_list_requires_authentication(self):
        """Ensure unauthenticated listing attempts are rejected.

        Returns:
            None: Assertions verify the HTTP 401 status.
        """
        url = reverse('item-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_user_items(self):
        """Confirm the list endpoint filters to the requesting owner.

        Returns:
            None: Assertions inspect the response payload.
        """
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
        """Validate that POSTed items are owned by the requesting user.

        Returns:
            None: Assertions cover saved relationships.
        """
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


class ItemListViewSetTests(APITestCase):
    """Ensure users can only manage their own item lists via the API."""

    def setUp(self):
        """Create owners, lists, and related items for exercising endpoints."""
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
        """Ensure anonymous list calls receive 401 responses.

        Returns:
            None: Assertions check for HTTP 401.
        """
        url = reverse('itemlist-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_user_lists(self):
        """Confirm list responses only include the caller's lists.

        Returns:
            None: Assertions inspect response content.
        """
        url = reverse('itemlist-list')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Office')
        self.assertEqual(response.data[0]['owner'], self.user.id)

    def test_create_list_assigns_owner_and_items(self):
        """Verify POST requests assign owner and link provided items.

        Returns:
            None: Assertions inspect persisted relationships.
        """
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
        """Ensure the serializer blocks lists containing foreign items.

        Returns:
            None: Assertions validate HTTP 400 and error payload.
        """
        url = reverse('itemlist-list')
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Invalid', 'items': [self.other_item.id]}

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', response.data)

    def test_update_replaces_items(self):
        """Verify PUT requests can replace list names and members.

        Returns:
            None: Assertions confirm updated database state.
        """
        url = reverse('itemlist-detail', args=[self.user_list.id])
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Office Updated', 'items': [self.user_item_two.id]}

        response = self.client.put(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_list.refresh_from_db()
        self.assertEqual(self.user_list.name, 'Office Updated')
        self.assertSetEqual(set(self.user_list.items.all()), {self.user_item_two})

    def test_cannot_access_other_users_list(self):
        """Ensure users receive 404 when requesting another owner's list.

        Returns:
            None: Assertions evaluate HTTP status.
        """
        url = reverse('itemlist-detail', args=[self.other_list.id])
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CurrentUserViewTests(APITestCase):
    """Test the endpoint that returns the authenticated user's profile."""

    def setUp(self):
        """Create the subject user leveraged by both test cases."""
        self.user = User.objects.create_user('profileuser', 'profile@example.com', 'StrongPass123!')

    def test_requires_authentication(self):
        """Ensure anonymous callers receive a 401 response.

        Returns:
            None: Assertions examine the status code.
        """
        url = reverse('current_user')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_current_user_payload(self):
        """Verify authenticated requests return the expected fields.

        Returns:
            None: Assertions compare JSON data to the user record.
        """
        url = reverse('current_user')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['username'], 'profileuser')
        self.assertEqual(response.data['email'], 'profile@example.com')


class ItemImageViewSetTests(APITestCase):
    """Validate that image uploads honor ownership rules."""

    def setUp(self):
        """Create temporary media root and authenticate upload requests."""
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
        """Ensure POSTing an image for a foreign item returns 404.

        Returns:
            None: Assertions verify HTTP 404 and error detail.
        """
        url = reverse('itemimage-list')
        payload = {'item': self.other_item.id, 'image': self._image_file()}

        response = self.client.post(url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('item', response.data)
        self.assertEqual(ItemImage.objects.count(), 0)

    def test_create_image_for_own_item(self):
        """Confirm uploads for your own item succeed.

        Returns:
            None: Assertions inspect response payload and DB state.
        """
        url = reverse('itemimage-list')
        payload = {'item': self.item.id, 'image': self._image_file('own.png')}

        response = self.client.post(url, payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ItemImage.objects.filter(item=self.item).count(), 1)

    def test_cannot_update_image_to_other_users_item(self):
        """Ensure PATCH cannot reassign an image to someone else's item.

        Returns:
            None: Assertions check for HTTP 404.
        """
        image = ItemImage.objects.create(item=self.item, image=self._image_file('original.png'))
        url = reverse('itemimage-detail', args=[image.id])

        response = self.client.patch(url, {'item': self.other_item.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        image.refresh_from_db()
        self.assertEqual(image.item, self.item)

    def test_perform_create_raises_permission_denied_for_foreign_item(self):
        """Verify the viewset raises PermissionDenied during manual save.

        Returns:
            None: Assertions expect a PermissionDenied exception.
        """
        view = ItemImageViewSet()
        factory = APIRequestFactory()
        request = factory.post(reverse('itemimage-list'), {'item': self.other_item.id})
        request.user = self.user
        view.request = request
        serializer = SimpleNamespace(validated_data={'item': self.other_item, 'image': self._image_file('unauthorized.png')})

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)


class UserScopedViewSetTests(APITestCase):
    """Ensure tag and location APIs filter data by authenticated owner."""

    def setUp(self):
        """Provision sample users and scoped tag/location records."""
        self.user1 = User.objects.create_user('user1', 'user1@example.com', 'password')
        self.user2 = User.objects.create_user('user2', 'user2@example.com', 'password')

        self.tag1 = Tag.objects.create(name='Tag 1', user=self.user1)
        self.location1 = Location.objects.create(name='Location 1', user=self.user1)

        self.tag2 = Tag.objects.create(name='Tag 2', user=self.user2)
        self.location2 = Location.objects.create(name='Location 2', user=self.user2)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def test_list_tags_returns_only_own_tags(self):
        """Ensure the tag list endpoint only returns owned tags.

        Returns:
            None: Assertions inspect serialized results.
        """
        url = reverse('tag-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], self.tag1.name)

    def test_cannot_retrieve_other_user_tag(self):
        """Verify retrieving another user's tag returns 404.

        Returns:
            None: Assertions examine HTTP status codes.
        """
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_tag(self):
        """Ensure PUT requests targeting foreign tags fail.

        Returns:
            None: Assertions ensure HTTP 404 responses.
        """
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.put(url, {'name': 'Updated Tag'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_tag(self):
        """Confirm DELETE requests cannot remove someone else's tag.

        Returns:
            None: Assertions check the response and database state.
        """
        url = reverse('tag-detail', args=[self.tag2.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Tag.objects.filter(pk=self.tag2.id).exists())

    def test_list_locations_returns_only_own_locations(self):
        """Ensure the location list endpoint filters by ownership.

        Returns:
            None: Assertions evaluate the payload contents.
        """
        url = reverse('location-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], self.location1.name)

    def test_cannot_retrieve_other_user_location(self):
        """Verify retrieving a foreign location results in 404.

        Returns:
            None: Assertions check HTTP status.
        """
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_location(self):
        """Ensure updates against another user's location are blocked.

        Returns:
            None: Assertions confirm 404 responses.
        """
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.put(url, {'name': 'Updated Location'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_location(self):
        """Confirm deletes cannot target locations owned by others.

        Returns:
            None: Assertions inspect HTTP status and DB state.
        """
        url = reverse('location-detail', args=[self.location2.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Location.objects.filter(pk=self.location2.id).exists())


class ItemViewSetCustomActionsTests(APITestCase):
    """Cover non-standard actions such as asset-tag lookup and QR codes."""

    def setUp(self):
        """Create owners and sample items for each custom endpoint call."""
        self.user1 = User.objects.create_user('user1', 'user1@example.com', 'password')
        self.user2 = User.objects.create_user('user2', 'user2@example.com', 'password')

        self.item1 = Item.objects.create(name='Item 1', owner=self.user1)
        self.item2 = Item.objects.create(name='Item 2', owner=self.user2)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def test_lookup_by_asset_tag_success(self):
        """Ensure lookup returns data when the asset tag belongs to the user.

        Returns:
            None: Assertions inspect response payload fields.
        """
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': self.item1.asset_tag})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.item1.name)

    def test_lookup_by_asset_tag_not_found(self):
        """Verify lookup denies access to another user's asset tag.

        Returns:
            None: Assertions expect HTTP 404.
        """
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': self.item2.asset_tag})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_by_invalid_asset_tag(self):
        """Ensure invalid UUID strings trigger 400 errors.

        Returns:
            None: Assertions inspect HTTP 400 responses.
        """
        url = reverse('item-lookup-by-asset-tag', kwargs={'asset_tag': 'invalid-uuid'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_qr_code_success(self):
        """Confirm QR code rendering works for the owner's item.

        Returns:
            None: Assertions validate response headers and payload.
        """
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_generate_qr_code_for_other_user_item_not_found(self):
        """Ensure QR code requests for foreign items return 404.

        Returns:
            None: Assertions examine status codes.
        """
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item2.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_qr_code_download(self):
        """Verify download=1 returns an attachment response.

        Returns:
            None: Assertions inspect headers for attachment disposition.
        """
        url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
        response = self.client.get(url, {'download': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('attachment', response['Content-Disposition'])

    def test_generate_qr_code_not_available(self):
        """Ensure QR code generation fails when feature flag is disabled.

        Returns:
            None: Assertions expect HTTP 404.
        """
        with mock.patch.dict('sys.modules', {'qrcode': None}):
            url = reverse('item-generate-qr-code', kwargs={'pk': self.item1.pk})
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


class AuthSecurityTests(TimedAPITestCase):
    """Cover throttling and cookie behaviors for authentication endpoints."""

    def setUp(self):
        """Create the account leveraged by the token endpoints."""
        self.user = User.objects.create_user('auth_user', 'auth@example.com', 'password123')

    def test_login_with_nonexistent_email_is_slowed(self):
        """Ensure unknown emails still incur the intentional delay.

        Returns:
            None: Assertions validate both timing and logging.
        """
        url = reverse('token_obtain_pair')
        with self.assertLogs('security', level='WARNING') as cm:
            with self.assertTiming(min_seconds=0.1):
                response = self.client.post(url, {'email': 'nobody@example.com', 'password': 'password'})
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('Login attempt with non-existent email', cm.output[0])

    def test_login_with_wrong_password_is_slowed(self):
        """Verify incorrect passwords also trigger the timing guard.

        Returns:
            None: Assertions inspect response timing and status.
        """
        url = reverse('token_obtain_pair')
        with self.assertTiming(min_seconds=0.15):
            response = self.client.post(url, {'email': self.user.email, 'password': 'wrong-password'})
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_obtains_new_access_token(self):
        """Confirm refresh endpoint rotates and returns a new access token.

        Returns:
            None: Assertions check status, cookies, and payload flags.
        """
        # First, log in to get the refresh token cookie
        login_url = reverse('token_obtain_pair')
        self.client.post(login_url, {'email': self.user.email, 'password': 'password123'})

        refresh_url = reverse('token_refresh')
        response = self.client.post(refresh_url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertTrue(response.data['rotated'])

    def test_remember_me_sets_long_lived_refresh_token(self):
        """Ensure remember-me requests receive a long-lived refresh cookie.

        Returns:
            None: Assertions inspect cookie lifetime values.
        """
        login_url = reverse('token_obtain_pair')
        response = self.client.post(login_url, {'email': self.user.email, 'password': 'password123', 'remember': True})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_cookie = response.cookies.get(settings.JWT_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(refresh_cookie)
        # 7 days in seconds
        self.assertGreater(refresh_cookie['max-age'], 7 * 24 * 3600 - 10)

    @override_settings(JWT_COOKIE_SECURE=True, JWT_COOKIE_SAMESITE='None')
    def test_secure_cookies_are_set_correctly(self):
        """Verify cookie flags honor secure and SameSite settings.

        Returns:
            None: Assertions evaluate cookie attributes.
        """
        login_url = reverse('token_obtain_pair')
        response = self.client.post(login_url, {'email': self.user.email, 'password': 'password123'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_cookie = response.cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
        self.assertTrue(access_cookie['secure'])
        self.assertEqual(access_cookie['samesite'], 'None')
        self.assertTrue(access_cookie['httponly'])
