import shutil
import tempfile
from io import BytesIO
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient, APITestCase, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Item, ItemImage, ItemList, Location, Tag
from .serializers import ItemListSerializer, ItemSerializer, UserRegistrationSerializer
from .views import ItemImageViewSet


User = get_user_model()


class UserRegistrationSerializerTests(TestCase):
    def test_password_mismatch_raises_error(self):
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'ValidPass123!',
            'password_confirm': 'DifferentPass123!',
        }
        serializer = UserRegistrationSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('password_confirm', serializer.errors)

    def test_create_hashes_password_and_returns_user(self):
        data = {
            'username': 'secureuser',
            'email': 'secureuser@example.com',
            'password': 'ValidPass123!',
            'password_confirm': 'ValidPass123!',
        }
        serializer = UserRegistrationSerializer(data=data)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertIsInstance(user, User)
        self.assertNotEqual(user.password, data['password'])
        self.assertTrue(user.check_password(data['password']))


class ItemSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('alice', 'alice@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('bob', 'bob@example.com', 'StrongPass123!')
        self.tag_user = Tag.objects.create(name='Electronics', user=self.user)
        self.tag_user_2 = Tag.objects.create(name='Appliances', user=self.user)
        self.tag_other = Tag.objects.create(name='Garden', user=self.other_user)
        self.location_user = Location.objects.create(name='Basement', user=self.user)
        self.location_other = Location.objects.create(name='Garage', user=self.other_user)

    def _build_request(self, user):
        return SimpleNamespace(user=user, auth=None)

    def _get_serializer(self, **kwargs):
        serializer = ItemSerializer(context={'request': kwargs.pop('request', self._build_request(self.user))}, **kwargs)
        tag_queryset = Tag.objects.filter(user=self.user)
        tag_field = serializer.fields['tags']
        tag_field.queryset = tag_queryset
        if hasattr(tag_field, 'child_relation'):
            tag_field.child_relation.queryset = tag_queryset
        serializer.fields['location'].queryset = Location.objects.filter(user=self.user)
        return serializer

    def test_querysets_scoped_to_authenticated_user(self):
        serializer = ItemSerializer(context={'request': self._build_request(self.user)})

        self.assertCountEqual(serializer.fields['tags'].queryset, [self.tag_user, self.tag_user_2])
        self.assertEqual(list(serializer.fields['location'].queryset), [self.location_user])

    def test_querysets_empty_for_anonymous_user(self):
        serializer = ItemSerializer(context={'request': self._build_request(AnonymousUser())})

        self.assertEqual(serializer.fields['tags'].queryset.count(), 0)
        self.assertEqual(serializer.fields['location'].queryset.count(), 0)

    def test_create_assigns_owner_and_tags(self):
        data = {
            'name': 'Laptop',
            'description': 'Work laptop',
            'quantity': 2,
            'value': '1200.00',
            'location': self.location_user.id,
            'tags': [self.tag_user.id, self.tag_user_2.id],
        }
        serializer = self._get_serializer(data=data, request=self._build_request(self.user))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        item = serializer.save()

        self.assertEqual(item.owner, self.user)
        self.assertEqual(item.tags.count(), 2)
        self.assertSetEqual(set(item.tags.all()), {self.tag_user, self.tag_user_2})
        self.assertEqual(item.location, self.location_user)

    def test_update_replaces_tags_and_fields(self):
        item = Item.objects.create(name='Camera', owner=self.user, location=self.location_user)
        item.tags.set([self.tag_user])
        data = {
            'name': 'DSLR Camera',
            'description': 'Camera for photography',
            'quantity': 3,
            'value': '800.50',
            'location': self.location_user.id,
            'tags': [self.tag_user_2.id],
        }
        serializer = self._get_serializer(instance=item, data=data, request=self._build_request(self.user))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_item = serializer.save()

        updated_item.refresh_from_db()
        self.assertEqual(updated_item.name, 'DSLR Camera')
        self.assertEqual(updated_item.description, 'Camera for photography')
        self.assertEqual(updated_item.quantity, 3)
        self.assertEqual(str(updated_item.value), '800.50')
        self.assertSetEqual(set(updated_item.tags.all()), {self.tag_user_2})


class ItemListSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('listowner', 'listowner@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('intruder', 'intruder@example.com', 'StrongPass123!')
        self.item_one = Item.objects.create(name='Camera', owner=self.user)
        self.item_two = Item.objects.create(name='Tripod', owner=self.user)
        self.other_item = Item.objects.create(name='Saw', owner=self.other_user)

    def _build_request(self, user):
        return SimpleNamespace(user=user, auth=None)

    def _get_serializer(self, **kwargs):
        context = kwargs.pop('context', {'request': self._build_request(self.user)})
        serializer = ItemListSerializer(context=context, **kwargs)
        item_queryset = Item.objects.filter(owner=self.user)
        items_field = serializer.fields['items']
        items_field.queryset = item_queryset
        if hasattr(items_field, 'child_relation'):
            items_field.child_relation.queryset = item_queryset
        return serializer

    def test_querysets_scoped_to_authenticated_user(self):
        serializer = ItemListSerializer(context={'request': self._build_request(self.user)})
        item_queryset = Item.objects.filter(owner=self.user)
        serializer.fields['items'].queryset = item_queryset
        if hasattr(serializer.fields['items'], 'child_relation'):
            serializer.fields['items'].child_relation.queryset = item_queryset

        self.assertCountEqual(serializer.fields['items'].queryset, [self.item_one, self.item_two])

    def test_querysets_empty_for_anonymous_user(self):
        serializer = ItemListSerializer(context={'request': self._build_request(AnonymousUser())})

        self.assertEqual(serializer.fields['items'].queryset.count(), 0)

    def test_create_assigns_owner_and_items(self):
        data = {'name': 'Photography', 'items': [self.item_one.id, self.item_two.id]}
        serializer = self._get_serializer(data=data)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        item_list = serializer.save()

        self.assertEqual(item_list.owner, self.user)
        self.assertSetEqual(set(item_list.items.all()), {self.item_one, self.item_two})

    def test_create_rejects_items_from_other_user(self):
        data = {'name': 'Invalid', 'items': [self.other_item.id]}
        serializer = self._get_serializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('items', serializer.errors)

    def test_update_replaces_items_and_name(self):
        item_list = ItemList.objects.create(name='Gear', owner=self.user)
        item_list.items.set([self.item_one])
        data = {'name': 'Studio Gear', 'items': [self.item_two.id]}
        serializer = self._get_serializer(instance=item_list, data=data)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_list = serializer.save()

        updated_list.refresh_from_db()
        self.assertEqual(updated_list.name, 'Studio Gear')
        self.assertSetEqual(set(updated_list.items.all()), {self.item_two})


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
        url = reverse('token_obtain_pair')
        payload = {'username': 'tokenuser', 'password': 'StrongPass123!'}

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'tokenuser')
        self.assertEqual(response.data['user']['email'], 'tokenuser@example.com')


class LogoutViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('logoutuser', 'logout@example.com', 'StrongPass123!')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_missing_refresh_token_returns_error(self):
        url = reverse('logout')

        response = self.client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Aktualisierungstoken erforderlich.')

    def test_invalid_refresh_token_returns_error(self):
        url = reverse('logout')

        response = self.client.post(url, {'refresh': 'not-a-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Aktualisierungstoken ungültig.')

    def test_valid_refresh_token_blacklists_and_returns_no_content(self):
        url = reverse('logout')
        refresh = RefreshToken.for_user(self.user)

        response = self.client.post(url, {'refresh': str(refresh)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


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

    def test_create_item_assigns_owner(self):
        url = reverse('item-list')
        self.client.force_authenticate(user=self.user)
        payload = {
            'name': 'Scanner',
            'quantity': 1,
            'location': self.location.id,
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Scanner')
        self.assertEqual(response.data['owner'], self.user.id)
        self.assertTrue(Item.objects.filter(name='Scanner', owner=self.user).exists())


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
