from .view_test_base import *  # noqa: F403

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

    def test_login_identifier_cache_key_ignores_spoofed_xff(self):

        throttle = LoginRateThrottle()
        request_one = SimpleNamespace(
            data={'email': ' Auth@Example.COM '},
            META={
                'HTTP_X_FORWARDED_FOR': '1.1.1.1',
                'REMOTE_ADDR': '127.0.0.1',
            },
        )
        request_two = SimpleNamespace(
            data={'email': 'auth@example.com'},
            META={
                'HTTP_X_FORWARDED_FOR': '2.2.2.2',
                'REMOTE_ADDR': '127.0.0.1',
            },
        )

        cache_key = throttle.get_cache_key(request_one, view=None)

        self.assertEqual(cache_key, throttle.get_cache_key(request_two, view=None))
        self.assertNotIn('auth@example.com', cache_key)

    def test_login_identifier_throttle_rejects_varied_spoofed_xff(self):

        cache.clear()
        self.addCleanup(cache.clear)
        throttle_rates = {
            **LoginRateThrottle.THROTTLE_RATES,
            'login': '2/minute',
            'login_ip': '100/minute',
        }
        url = reverse('token_obtain_pair')
        payload = {'email': 'spoofed@example.com', 'password': 'wrong-password'}

        with mock.patch.object(LoginRateThrottle, 'THROTTLE_RATES', throttle_rates):
            with mock.patch.object(LoginIPRateThrottle, 'THROTTLE_RATES', throttle_rates):
                with mock.patch('inventory.api.auth_tokens.time.sleep', return_value=None):
                    first_response = self.client.post(
                        url,
                        payload,
                        format='json',
                        HTTP_X_FORWARDED_FOR='1.1.1.1',
                    )
                    second_response = self.client.post(
                        url,
                        payload,
                        format='json',
                        HTTP_X_FORWARDED_FOR='2.2.2.2',
                    )
                    third_response = self.client.post(
                        url,
                        payload,
                        format='json',
                        HTTP_X_FORWARDED_FOR='3.3.3.3',
                    )

        self.assertEqual(first_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(second_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(third_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_ip_throttle_uses_cleaned_xff_with_configured_proxy(self):

        rest_framework_settings = rest_framework_settings_with(NUM_PROXIES=1)
        request = SimpleNamespace(
            META={
                'HTTP_X_FORWARDED_FOR': '203.0.113.25',
                'REMOTE_ADDR': '127.0.0.1',
            },
        )

        with temporary_rest_framework_settings(rest_framework_settings):
            self.assertEqual(LoginIPRateThrottle().get_ident(request), '203.0.113.25')

    def test_login_with_nonexistent_email_is_slowed(self):

        url = reverse('token_obtain_pair')
        with self.assertLogs('security', level='WARNING') as cm:
            with self.assertTiming(min_seconds=0.1):
                response = self.client.post(url, {'email': 'nobody@example.com', 'password': 'password'})
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(any('Authentication failed' in message for message in cm.output))

    def test_login_with_wrong_password_is_slowed(self):

        url = reverse('token_obtain_pair')
        with self.assertTiming(min_seconds=0.15):
            response = self.client.post(url, {'email': self.user.email, 'password': 'wrong-password'})
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_obtains_new_access_token(self):

        login_url = reverse('token_obtain_pair')
        self.client.post(login_url, {'email': self.user.email, 'password': 'password123'})

        refresh_url = reverse('token_refresh')
        csrf_token = set_csrf_cookie(self.client)
        response = self.client.post(refresh_url, {}, HTTP_X_CSRFTOKEN=csrf_token)
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
