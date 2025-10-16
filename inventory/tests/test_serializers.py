from types import SimpleNamespace
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from ..models import Item, ItemList, Location, Tag
from ..serializers import ItemListSerializer, ItemSerializer, UserRegistrationSerializer

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
            'wodis_inventory_number': 'W-12345',
            'tags': [self.tag_user.id, self.tag_user_2.id],
        }
        serializer = self._get_serializer(data=data, request=self._build_request(self.user))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        item = serializer.save()

        self.assertEqual(item.owner, self.user)
        self.assertEqual(item.tags.count(), 2)
        self.assertSetEqual(set(item.tags.all()), {self.tag_user, self.tag_user_2})
        self.assertEqual(item.location, self.location_user)
        self.assertEqual(item.wodis_inventory_number, 'W-12345')

    def test_update_replaces_tags_and_fields(self):
        item = Item.objects.create(name='Camera', owner=self.user, location=self.location_user)
        item.tags.set([self.tag_user])
        data = {
            'name': 'DSLR Camera',
            'description': 'Camera for photography',
            'quantity': 3,
            'value': '800.50',
            'location': self.location_user.id,
            'wodis_inventory_number': 'W-987',
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
        self.assertEqual(updated_item.wodis_inventory_number, 'W-987')

    def test_blank_wodis_inventory_number_becomes_none(self):
        item = Item.objects.create(name='Tablet', owner=self.user, location=self.location_user, wodis_inventory_number='TMP-1')
        data = {
            'name': 'Tablet',
            'description': '',
            'quantity': 1,
            'value': '',
            'location': self.location_user.id,
            'wodis_inventory_number': '',
            'tags': [],
        }
        serializer = self._get_serializer(instance=item, data=data, request=self._build_request(self.user))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_item = serializer.save()

        updated_item.refresh_from_db()
        self.assertIsNone(updated_item.wodis_inventory_number)


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
