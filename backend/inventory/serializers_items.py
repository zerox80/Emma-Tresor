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
from .serializers_catalog import ItemImageSerializer

class ItemSerializer(serializers.ModelSerializer):
    
    tags = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Tag.objects.none())
    owner = serializers.ReadOnlyField(source='owner.id')
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=10000)
    asset_tag = serializers.UUIDField(read_only=True)
    wodis_inventory_number = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=120,
        trim_whitespace=True,
    )
    employee_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=255,
        trim_whitespace=True,
    )
    room_number = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=50,
        trim_whitespace=True,
    )
    images = ItemImageSerializer(many=True, read_only=True)

    class Meta:
        
        model = Item
        fields = [
            'id',
            'name',
            'description',
            'quantity',
            'purchase_date',
            'value',
            'asset_tag',
            'owner',
            'location',
            'wodis_inventory_number',
            'employee_name',
            'room_number',
            'tags',
            'images',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'asset_tag', 'owner', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        tags_field = self.fields['tags']
        location_field = self.fields['location']

        if request and request.user and request.user.is_authenticated:
            user = request.user
            tags_qs = Tag.objects.filter(user=user)
            locations_qs = Location.objects.filter(user=user)
            tags_field.queryset = tags_qs
            if hasattr(tags_field, 'child_relation'):
                tags_field.child_relation.queryset = tags_qs
            location_field.queryset = locations_qs
        else:

            user = None
            empty_tags = Tag.objects.none()
            tags_field.queryset = empty_tags
            if hasattr(tags_field, 'child_relation'):
                tags_field.child_relation.queryset = empty_tags
            empty_locations = Location.objects.none()
            location_field.queryset = empty_locations

    def _require_user(self) -> User:
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        return user

    def validate(self, attrs):
        
        user = self._require_user()

        location = attrs.get('location')
        if location and location.user_id != user.id:
            raise serializers.ValidationError({'location': 'Dieser Standort gehört nicht zu deinem Konto.'})

        tags = attrs.get('tags', [])
        if tags:
            invalid_tags = [tag for tag in tags if tag.user_id != user.id]
            if invalid_tags:
                raise serializers.ValidationError(
                    {'tags': 'Mindestens eines der ausgew?hlten Tags geh?rt einem anderen Benutzer.'}
                )
        return attrs

    def validate_purchase_date(self, value):
        
        if value is None:
            return value

        from datetime import date
        if value > date.today():
            raise serializers.ValidationError('Das Kaufdatum darf nicht in der Zukunft liegen.')

        from datetime import date, timedelta
        min_date = date.today() - timedelta(days=365 * MAX_PURCHASE_AGE_YEARS)
        if value < min_date:
            raise serializers.ValidationError('Das Kaufdatum ist zu alt. Maximal 50 Jahre zurück.')

        return value

    def validate_value(self, value):
        
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Der Wert darf nicht negativ sein.')
        if value > 999999999.99:
            raise serializers.ValidationError('Der Wert ist zu hoch. Maximal 999.999.999,99 € erlaubt.')

        value_str = str(value)
        if '.' in value_str:
            decimal_part = value_str.split('.')[-1]
            if len(decimal_part) > 2:
                raise serializers.ValidationError('Der Wert darf maximal 2 Dezimalstellen haben.')

        return value

    def _normalise_payload(self, data: dict) -> dict:

        if 'description' in data and (data['description'] is None or data['description'] == ''):
            data['description'] = None
        else:

            if data.get('description'):

                allowed_tags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']
                allowed_attributes = {
                    '*': ['class', 'id'],
                    'a': ['href', 'title'],
                    'p': ['class'],
                    'br': ['class'],
                    'strong': ['class'],
                    'em': ['class'],
                    'ul': ['class'],
                    'ol': ['class'],
                    'li': ['class'],
                }

                data['description'] = bleach.clean(
                    data['description'],
                    tags=allowed_tags,
                    attributes=allowed_attributes,
                    strip=True
                )
        
        if 'purchase_date' in data and (data['purchase_date'] is None or data['purchase_date'] == ''):
            data['purchase_date'] = None
        if 'value' in data and (data['value'] is None or data['value'] == ''):
            data['value'] = None
        if 'wodis_inventory_number' in data:
            raw_value = data['wodis_inventory_number']
            if raw_value in {None, ''}:
                data['wodis_inventory_number'] = None
            else:
                cleaned = str(raw_value).strip()
                data['wodis_inventory_number'] = cleaned or None
        # Handle employee_name field
        if 'employee_name' in data:
            raw_value = data['employee_name']
            if raw_value in {None, ''}:
                data['employee_name'] = None
            else:
                cleaned = str(raw_value).strip()
                data['employee_name'] = cleaned or None
        # Handle room_number field
        if 'room_number' in data:
            raw_value = data['room_number']
            if raw_value in {None, ''}:
                data['room_number'] = None
            else:
                cleaned = str(raw_value).strip()
                data['room_number'] = cleaned or None
        return data

    def create(self, validated_data):
        
        user = self._require_user()
        tags = validated_data.pop('tags', [])
        validated_data.pop('owner', None)
        normalised = self._normalise_payload(validated_data)
        item = Item.objects.create(owner=user, **normalised)
        if tags:
            item.tags.set([tag for tag in tags if tag.user_id == user.id])
        return item

    def update(self, instance, validated_data):
        
        user = self._require_user()
        tags = validated_data.pop('tags', None)
        old_tag_ids = sorted(instance.tags.values_list('id', flat=True)) if tags is not None else None
        normalised = self._normalise_payload(validated_data)

        allowed_fields = {
            'name',
            'description',
            'quantity',
            'purchase_date',
            'value',
            'location',
            'wodis_inventory_number',
            'employee_name',
            'room_number',
        }
        for field in list(normalised.keys()):
            if field not in allowed_fields:
                normalised.pop(field)

        for attr, value in normalised.items():
            setattr(instance, attr, value)
        instance.save()

        if tags is not None:
            own_tags = [tag for tag in tags if tag.user_id == user.id]
            instance.tags.set(own_tags)
            new_tag_ids = sorted(instance.tags.values_list('id', flat=True))
            if old_tag_ids != new_tag_ids:
                ItemChangeLog.objects.create(
                    item=instance,
                    action='update',
                    user=user,
                    item_name=instance.name,
                    changes={'tags': {'old': old_tag_ids, 'new': new_tag_ids}},
                )
        return instance
