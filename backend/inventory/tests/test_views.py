from .view_test_base import *  # noqa: F403

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

    def test_token_accepts_mixed_case_username(self):

        with mock.patch('rest_framework.views.APIView.get_throttles', return_value=[]):
            url = reverse('token_obtain_pair')
            payload = {'username': 'TOKENUSER', 'password': 'StrongPass123!'}

            response = self.client.post(url, payload, format='json')

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['user']['username'], 'tokenuser')

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

    def test_cookie_logout_without_csrf_is_rejected(self):

        client = APIClient(enforce_csrf_checks=True)
        refresh = RefreshToken.for_user(self.user)
        client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(refresh.access_token)
        client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = str(refresh)
        url = reverse('logout')

        response = client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cookie_logout_with_csrf_succeeds_and_clears_cookies(self):

        client = APIClient(enforce_csrf_checks=True)
        refresh = RefreshToken.for_user(self.user)
        client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(refresh.access_token)
        client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = str(refresh)
        csrf_token = set_csrf_cookie(client)
        url = reverse('logout')

        response = client.post(url, {}, format='json', HTTP_X_CSRFTOKEN=csrf_token)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
        self.assertEqual(response.cookies[settings.JWT_ACCESS_COOKIE_NAME].value, '')
        self.assertEqual(response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value, '')

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
        
        Item.objects.create(
            name='Frank Haus',
            description='Bürostuhl Frank',
            owner=self.user,
            location=self.location,
            wodis_inventory_number='WODIS-1',
            purchase_date=date.today(),
        )
        Item.objects.create(
            name='Frank Biel',
            description='Bürostuhl Frank mit Rollen',
            owner=self.user,
            location=self.location,
            wodis_inventory_number='WODIS-1',
            purchase_date=date.today(),
        )

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

    def test_export_neutralizes_formula_text_fields(self):

        formula_location = Location.objects.create(name='=Location', user=self.user)
        item = Item.objects.create(
            name='=cmd',
            description='+description',
            owner=self.user,
            location=formula_location,
            wodis_inventory_number='@inventory',
        )
        tag = Tag.objects.create(name='-tag', user=self.user)
        item.tags.set([tag])
        item_list = ItemList.objects.create(name='=list', owner=self.user)
        item_list.items.set([item])

        url = reverse('item-export-items')
        self.client.force_authenticate(user=self.user)

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = list(csv.reader(StringIO(response.content.decode('utf-8-sig')), delimiter=';'))
        exported = next(row for row in rows[1:] if int(row[0]) == item.id)
        self.assertEqual(exported[1], "'=cmd")
        self.assertEqual(exported[2], "'+description")
        self.assertEqual(exported[4], "'=Location")
        self.assertEqual(exported[5], "'-tag")
        self.assertEqual(exported[6], "'=list")
        self.assertEqual(exported[7], "'@inventory")

class DuplicateQuarantineViewSetTests(APITestCase):

    def setUp(self):

        self.client = APIClient()
        self.user = User.objects.create_user('dupe-owner', 'dupes@example.com', 'StrongPass123!')
        self.item_one = Item.objects.create(name='Chair A', owner=self.user)
        self.item_two = Item.objects.create(name='Chair B', owner=self.user)
        self.client.force_authenticate(user=self.user)

    def test_reversed_duplicate_pair_returns_validation_error(self):

        DuplicateQuarantine.objects.create(owner=self.user, item_a=self.item_one, item_b=self.item_two)
        url = reverse('duplicate-quarantine-list')
        payload = {'item_a_id': self.item_two.id, 'item_b_id': self.item_one.id}

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            DuplicateQuarantine.objects.filter(owner=self.user, is_active=True).count(),
            1,
        )

    def test_restore_collision_returns_validation_error(self):

        DuplicateQuarantine.objects.create(owner=self.user, item_a=self.item_one, item_b=self.item_two)
        inactive = DuplicateQuarantine.objects.create(
            owner=self.user,
            item_a=self.item_two,
            item_b=self.item_one,
            is_active=False,
        )
        url = reverse('duplicate-quarantine-restore', args=[inactive.id])

        response = self.client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        inactive.refresh_from_db()
        self.assertFalse(inactive.is_active)
