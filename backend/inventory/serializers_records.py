# Django REST Framework Serializers for Inventory API
# ====================================================
# This module defines all serializers that convert between Python objects and JSON
# for the REST API. Serializers handle:
# - Data validation (ensuring input meets requirements)
# - Data transformation (Python objects <-> JSON)
# - Security controls (user isolation, permission checks)
# - Field-level access control (read-only, write-only fields)
#
# Each serializer corresponds to a model and includes comprehensive validation
# to ensure data integrity and security.

from django.contrib.auth import get_user_model                      # Get configured User model
from django.contrib.auth.password_validation import validate_password  # Django password validators
from django.core.exceptions import ValidationError                  # Django validation errors
from rest_framework import serializers                              # DRF serializers
from rest_framework.validators import UniqueValidator               # Unique field validators
from rest_framework.reverse import reverse                          # URL generation
import mimetypes                                                    # MIME type detection
import os                                                           # File path operations
import bleach                                                       # HTML sanitization
from django.utils.html import strip_tags                            # HTML tag removal

# Import models and constants
from .models import (
    Item,
    ItemImage,
    ItemChangeLog,
    ItemList,
    Location,
    Tag,
    MAX_PURCHASE_AGE_YEARS,
    DuplicateQuarantine,
)

# Get the User model (either Django's default or custom model)
User = get_user_model()
class DuplicateCandidateSerializer(serializers.ModelSerializer):
    """Lightweight serializer for duplicate finder results."""

    location = serializers.IntegerField(source='location_id', read_only=True)

    class Meta:
        model = Item
        fields = [
            'id',
            'name',
            'description',
            'quantity',
            'purchase_date',
            'value',
            'location',
            'wodis_inventory_number',
            'employee_name',
            'room_number',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class DuplicateQuarantineSerializer(serializers.ModelSerializer):
    """Serializer for quarantine entries with embedded item previews."""

    item_a = DuplicateCandidateSerializer(read_only=True)
    item_b = DuplicateCandidateSerializer(read_only=True)
    item_a_id = serializers.PrimaryKeyRelatedField(queryset=Item.objects.none(), write_only=True, source='item_a')
    item_b_id = serializers.PrimaryKeyRelatedField(queryset=Item.objects.none(), write_only=True, source='item_b')

    class Meta:
        model = DuplicateQuarantine
        fields = [
            'id',
            'item_a',
            'item_b',
            'item_a_id',
            'item_b_id',
            'reason',
            'notes',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'item_a', 'item_b', 'is_active', 'created_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = getattr(self.context.get('request'), 'user', None)
        queryset = Item.objects.filter(owner=user) if user and user.is_authenticated else Item.objects.none()
        self.fields['item_a_id'].queryset = queryset
        self.fields['item_b_id'].queryset = queryset

    def validate(self, attrs):
        item_a = attrs.get('item_a') or getattr(self.instance, 'item_a', None)
        item_b = attrs.get('item_b') or getattr(self.instance, 'item_b', None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')

        if item_a and item_b:
            if item_a.pk == item_b.pk:
                raise serializers.ValidationError('Item-Paare müssen unterschiedlich sein.')
            if item_a.owner_id != user.id or item_b.owner_id != user.id:
                raise serializers.ValidationError('Quarantäne-Paare müssen zu deinem Konto gehören.')

            if item_a.pk > item_b.pk:
                item_a, item_b = item_b, item_a
                attrs['item_a'] = item_a
                attrs['item_b'] = item_b

            existing = DuplicateQuarantine.objects.filter(
                owner=user,
                item_a=item_a,
                item_b=item_b,
                is_active=True,
            )
            if self.instance is not None:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError('Dieses Quarantäne-Paar existiert bereits.')
        return attrs

class ItemListSerializer(serializers.ModelSerializer):
    
    items = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Item.objects.none())
    owner = serializers.ReadOnlyField(source='owner.id')

    class Meta:
        
        model = ItemList
        fields = ['id', 'name', 'owner', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def validate_name(self, value):
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        normalised = value.strip()
        if not user or not user.is_authenticated:
            return normalised

        queryset = ItemList.objects.filter(owner=user, name__iexact=normalised)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError('Eine Liste mit diesem Namen existiert bereits.')

        return normalised

    def _require_user(self):
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        return user

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        items_field = self.fields['items']
        if request and request.user and request.user.is_authenticated:
            items_qs = Item.objects.filter(owner=request.user)
            items_field.queryset = items_qs
            if hasattr(items_field, 'child_relation'):
                items_field.child_relation.queryset = items_qs
        else:
            empty_items = Item.objects.none()
            items_field.queryset = empty_items
            if hasattr(items_field, 'child_relation'):
                items_field.child_relation.queryset = empty_items

    def create(self, validated_data):
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        user = self._require_user()

        items = validated_data.pop('items', [])

        validated_data.pop('owner', None)
        item_list = ItemList.objects.create(owner=user, **validated_data)
        if items:
            own_items = [item for item in items if item.owner_id == user.id]
            item_list.items.set(own_items)
        return item_list

    def update(self, instance, validated_data):
        
        items = validated_data.pop('items', None)
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items is not None:
            user = self._require_user()
            filtered_items = [item for item in items if item.owner_id == user.id]
            instance.items.set(filtered_items)
        return instance

    def validate_items(self, value):
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user:
            invalid_items = [item for item in value if item.owner_id != user.id]
            if invalid_items:
                raise serializers.ValidationError('Listen können nur eigene Gegenstände enthalten.')
        return value

class ItemChangeLogSerializer(serializers.ModelSerializer):
    
    user_username = serializers.CharField(source='user.username', read_only=True, default=None)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._location_cache: dict[int, str] = {}
        self._tag_cache: dict[int, str] = {}

    def _resolve_location_name(self, value):
        if value in (None, ''):
            return None
        try:
            location_id = int(value)
        except (TypeError, ValueError):
            return value

        if location_id in self._location_cache:
            return self._location_cache[location_id]

        location = Location.objects.filter(pk=location_id).only('name').first()
        if location is None:
            name = f"#{location_id}"
        else:
            name = location.name

        self._location_cache[location_id] = name
        return name

    def _resolve_tag_name(self, value):
        if value in (None, ''):
            return value
        try:
            tag_id = int(value)
        except (TypeError, ValueError):
            return value

        if tag_id in self._tag_cache:
            return self._tag_cache[tag_id]

        tag = Tag.objects.filter(pk=tag_id).only('name').first()
        if tag is None:
            name = f"#{tag_id}"
        else:
            name = tag.name

        self._tag_cache[tag_id] = name
        return name

    def _resolve_tag_names(self, value):
        if value in (None, ''):
            return value
        if isinstance(value, (list, tuple, set)):
            return [self._resolve_tag_name(tag_id) for tag_id in value]
        return self._resolve_tag_name(value)

    def to_representation(self, instance):
        
        data = super().to_representation(instance)
        changes = data.get('changes')
        if isinstance(changes, dict):
            changes = {
                field: dict(change) if isinstance(change, dict) else change
                for field, change in changes.items()
            }
            data['changes'] = changes
            location_change = changes.get('location_id')
            if isinstance(location_change, dict):
                for key in ('old', 'new'):
                    location_change[key] = self._resolve_location_name(location_change.get(key))
            tag_change = changes.get('tags')
            if isinstance(tag_change, dict):
                for key in ('old', 'new'):
                    tag_change[key] = self._resolve_tag_names(tag_change.get(key))
        return data

    class Meta:
        
        model = ItemChangeLog
        fields = [
            'id',
            'item',
            'item_name',
            'user',
            'user_username',
            'action',
            'action_display',
            'changes',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'item',
            'item_name',
            'user',
            'user_username',
            'action',
            'action_display',
            'changes',
            'created_at',
        ]
