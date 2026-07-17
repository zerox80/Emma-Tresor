from decimal import Decimal
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from inventory.api.items import ItemViewSet
from inventory.audit import audit_actor
from inventory.models import DuplicateQuarantine, Item, ItemChangeLog, Location, Tag
from inventory.serializers import UserRegistrationSerializer

from .view_test_base import set_csrf_cookie


User = get_user_model()


class AuthenticationHardeningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            'csrf-login',
            'csrf-login@example.com',
            'StrongPass123!',
        )

    def test_login_without_csrf_is_rejected_before_installing_cookies(self):
        client = APIClient(enforce_csrf_checks=True)

        response = client.post(
            reverse('token_obtain_pair'),
            {'username': self.user.username, 'password': 'StrongPass123!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)

    def test_login_with_csrf_installs_authentication_cookies(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf_token = set_csrf_cookie(client)

        response = client.post(
            reverse('token_obtain_pair'),
            {'username': self.user.username, 'password': 'StrongPass123!'},
            format='json',
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)

    @override_settings(ALLOW_USER_REGISTRATION=True)
    def test_public_config_exposes_registration_flag(self):
        response = self.client.get(reverse('public_config'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data['registration_enabled'], True)


class RegistrationIdentityHardeningTests(TestCase):
    def test_database_rejects_case_insensitive_duplicate_email(self):
        User.objects.create_user('first', 'CaseSensitive@example.com', 'StrongPass123!')

        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user('second', 'casesensitive@EXAMPLE.com', 'StrongPass123!')

    def test_database_rejects_case_insensitive_duplicate_username(self):
        User.objects.create_user('CaseSensitive', 'first@example.com', 'StrongPass123!')

        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user('casesensitive', 'second@example.com', 'StrongPass123!')

    def test_registration_rejects_case_insensitive_duplicate_username(self):
        User.objects.create_user('CaseSensitive', 'first@example.com', 'StrongPass123!')
        serializer = UserRegistrationSerializer(data={
            'username': 'casesensitive',
            'email': 'second@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)

    def test_password_validation_uses_candidate_user_attributes(self):
        serializer = UserRegistrationSerializer(data={
            'username': 'newmember',
            'email': 'newmember@example.com',
            'password': 'newmember2026!',
            'password_confirm': 'newmember2026!',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)


class ItemAggregateHardeningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('stats-owner', 'stats@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('stats-other', 'other-stats@example.com', 'StrongPass123!')
        Item.objects.bulk_create([
            Item(
                name=f'Match {index:02d}',
                owner=self.user,
                quantity=2,
                value=Decimal('10.50'),
            )
            for index in range(25)
        ])
        Item.objects.create(name='Excluded', owner=self.user, quantity=1)
        Item.objects.create(name='Match foreign', owner=self.other_user, quantity=100)
        self.client.force_authenticate(user=self.user)

    def test_stats_cover_all_filtered_pages_and_remain_owner_scoped(self):
        response = self.client.get(
            reverse('item-stats'),
            {'search': 'Match', 'page_size': 5},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_items'], 25)
        self.assertEqual(response.data['total_quantity'], 50)
        self.assertEqual(Decimal(str(response.data['total_value'])), Decimal('262.50'))

    def test_dashboard_returns_bounded_server_side_summary(self):
        response = self.client.get(reverse('item-dashboard'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_items'], 26)
        self.assertEqual(response.data['total_quantity'], 51)
        self.assertEqual(len(response.data['recent_items']), 5)
        self.assertTrue(all(item['owner'] == self.user.id for item in response.data['recent_items']))


class DuplicatePerformanceHardeningTests(TestCase):
    def test_exact_name_matching_only_compares_items_in_the_same_bucket(self):
        items = [Item(id=index + 1, name=f'Unique {index}') for index in range(200)]
        items[-1].name = items[0].name
        options = {
            'name_match': 'exact',
            'description_match': 'none',
            'wodis_match': 'none',
            'purchase_tolerance': None,
            'require_any_text_match': False,
        }

        pairs = list(ItemViewSet()._candidate_pairs(items, options))

        self.assertEqual(pairs, [(0, 199)])


class DuplicateQuarantineAtomicityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('batch-owner', 'batch@example.com', 'StrongPass123!')
        self.other_user = User.objects.create_user('batch-other', 'batch-other@example.com', 'StrongPass123!')
        self.item_one = Item.objects.create(name='Chair A', owner=self.user)
        self.item_two = Item.objects.create(name='Chair B', owner=self.user)
        self.item_three = Item.objects.create(name='Chair C', owner=self.user)
        self.other_item = Item.objects.create(name='Foreign chair', owner=self.other_user)
        self.client.force_authenticate(user=self.user)

    def test_batch_create_rolls_back_every_pair_when_one_is_invalid(self):
        response = self.client.post(
            reverse('duplicate-quarantine-batch-create'),
            {
                'pairs': [
                    {'item_a_id': self.item_one.id, 'item_b_id': self.item_two.id},
                    {'item_a_id': self.item_one.id, 'item_b_id': self.other_item.id},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(DuplicateQuarantine.objects.filter(owner=self.user).exists())

    def test_batch_create_uses_bounded_queries_and_creates_every_pair(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(
                reverse('duplicate-quarantine-batch-create'),
                {
                    'pairs': [
                        {'item_a_id': self.item_one.id, 'item_b_id': self.item_two.id},
                        {'item_a_id': self.item_one.id, 'item_b_id': self.item_three.id},
                    ],
                },
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DuplicateQuarantine.objects.filter(owner=self.user).count(), 2)
        self.assertLessEqual(len(queries), 8)

    def test_batch_release_keeps_every_pair_active_when_one_id_is_invalid(self):
        first = DuplicateQuarantine.objects.create(
            owner=self.user,
            item_a=self.item_one,
            item_b=self.item_two,
        )
        second = DuplicateQuarantine.objects.create(
            owner=self.user,
            item_a=self.item_one,
            item_b=self.item_three,
        )

        response = self.client.post(
            reverse('duplicate-quarantine-batch-release'),
            {'ids': [first.id, second.id, 999999]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            DuplicateQuarantine.objects.filter(pk__in=[first.id, second.id], is_active=True).count(),
            2,
        )


class AuditHardeningTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('audit-owner', 'audit@example.com', 'StrongPass123!')
        self.staff = User.objects.create_user('audit-staff', 'staff@example.com', 'StrongPass123!')
        self.item = Item.objects.create(name='Audited item', owner=self.owner)
        self.tag = Tag.objects.create(name='Audited tag', user=self.owner)
        self.location = Location.objects.create(name='Audited location', user=self.owner)

    def test_explicit_actor_is_recorded_instead_of_item_owner(self):
        with audit_actor(self.staff):
            self.item.quantity = 2
            self.item.save()

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.user, self.staff)

    def test_unknown_actor_is_not_misattributed_to_item_owner(self):
        self.item.quantity = 2
        self.item.save()

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertIsNone(log.user)

    def test_update_fields_only_audits_values_written_to_the_database(self):
        self.item.name = 'Persisted name'
        self.item.description = 'Not persisted'
        self.item.save(update_fields=['name'])

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.changes, {
            'name': {'old': 'Audited item', 'new': 'Persisted name'},
        })
        self.item.refresh_from_db()
        self.assertIsNone(self.item.description)

    def test_owner_transfer_is_audited_as_a_security_boundary_change(self):
        with audit_actor(self.staff):
            self.item.owner = self.staff
            self.item.save(update_fields=['owner'])

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.user, self.staff)
        self.assertEqual(log.changes['owner_id'], {
            'old': self.owner.id,
            'new': self.staff.id,
        })

    def test_audit_failure_rolls_back_the_item_write(self):
        with mock.patch(
            'inventory.signals.ItemChangeLog.objects.create',
            side_effect=RuntimeError('audit store unavailable'),
        ):
            with self.assertRaises(RuntimeError):
                Item.objects.create(name='Must roll back', owner=self.owner)

        self.assertFalse(Item.objects.filter(name='Must roll back', owner=self.owner).exists())

    def test_reverse_tag_operations_are_audited(self):
        self.tag.items.add(self.item)

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.changes['tags'], {'old': [], 'new': [self.tag.id]})

    def test_tag_deletion_is_audited(self):
        self.item.tags.add(self.tag)
        ItemChangeLog.objects.filter(item=self.item, action='update').delete()
        tag_id = self.tag.id

        with audit_actor(self.staff):
            self.tag.delete()

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.user, self.staff)
        self.assertEqual(log.changes['tags'], {'old': [tag_id], 'new': []})

    def test_location_deletion_is_audited(self):
        self.item.location = self.location
        self.item.save()
        ItemChangeLog.objects.filter(item=self.item, action='update').delete()
        location_id = self.location.id

        with audit_actor(self.staff):
            self.location.delete()

        log = ItemChangeLog.objects.filter(item=self.item, action='update').latest('created_at')
        self.assertEqual(log.user, self.staff)
        self.assertEqual(log.changes['location_id'], {'old': location_id, 'new': None})

    def test_item_save_does_not_query_migration_state(self):
        with CaptureQueriesContext(connection) as queries:
            self.item.quantity = 3
            self.item.save()

        self.assertFalse(any('django_migrations' in query['sql'].lower() for query in queries))
