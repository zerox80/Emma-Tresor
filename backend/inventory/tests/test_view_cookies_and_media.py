from .view_test_base import *  # noqa: F403

class CookieJWTCSRFSecurityTests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user('csrf_user', 'csrf@example.com', 'StrongPass123!')
        self.location = Location.objects.create(name='Storage', user=self.user)

    def set_access_cookie(self, client):

        refresh = RefreshToken.for_user(self.user)
        client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(refresh.access_token)
        return refresh

    def test_cookie_access_token_post_without_csrf_is_rejected(self):

        client = APIClient(enforce_csrf_checks=True)
        self.set_access_cookie(client)
        url = reverse('item-list')

        response = client.post(url, {'name': 'Blocked', 'quantity': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Item.objects.filter(name='Blocked', owner=self.user).exists())

    def test_cookie_access_token_get_without_csrf_succeeds(self):

        client = APIClient(enforce_csrf_checks=True)
        self.set_access_cookie(client)
        url = reverse('item-list')

        response = client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cookie_access_token_post_with_csrf_succeeds(self):

        client = APIClient(enforce_csrf_checks=True)
        self.set_access_cookie(client)
        csrf_token = set_csrf_cookie(client)
        url = reverse('item-list')

        response = client.post(
            url,
            {'name': 'Allowed', 'quantity': 1, 'location': self.location.id},
            format='json',
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Item.objects.filter(name='Allowed', owner=self.user).exists())

    def test_bearer_access_token_post_without_csrf_succeeds(self):

        client = APIClient(enforce_csrf_checks=True)
        refresh = RefreshToken.for_user(self.user)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        url = reverse('item-list')

        response = client.post(
            url,
            {'name': 'Bearer Allowed', 'quantity': 1, 'location': self.location.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Item.objects.filter(name='Bearer Allowed', owner=self.user).exists())

    def test_refresh_cookie_without_csrf_is_rejected(self):

        client = APIClient(enforce_csrf_checks=True)
        refresh = RefreshToken.for_user(self.user)
        client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = str(refresh)
        url = reverse('token_refresh')

        response = client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_refresh_cookie_with_csrf_succeeds(self):

        client = APIClient(enforce_csrf_checks=True)
        refresh = RefreshToken.for_user(self.user)
        client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = str(refresh)
        csrf_token = set_csrf_cookie(client)
        url = reverse('token_refresh')

        response = client.post(url, {}, format='json', HTTP_X_CSRFTOKEN=csrf_token)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)

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
        serializer = SimpleNamespace(
            validated_data={
                'item': self.other_item,
                'image': self._image_file('unauthorized.png'),
            }
        )

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)
