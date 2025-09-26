from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Item, ItemImage, ItemList, Location, Tag


User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all(), lookup='iexact')],
    )
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'password_confirm']
        read_only_fields = ['id']

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)
        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Die Passwörter stimmen nicht überein.'})
        email = attrs.get('email')
        if email:
            attrs['email'] = email.strip().lower()
        validate_password(password)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        normalised = value.strip()
        if not user or not user.is_authenticated:
            return normalised

        queryset = Tag.objects.filter(user=user, name__iexact=normalised)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError('Ein Schlagwort mit diesem Namen existiert bereits.')

        return normalised

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        validated_data['user'] = user
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or instance.user_id != user.id:
            raise serializers.ValidationError('Dieses Schlagwort gehört nicht zu deinem Konto.')
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().update(instance, validated_data)


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        normalised = value.strip()
        if not user or not user.is_authenticated:
            return normalised

        queryset = Location.objects.filter(user=user, name__iexact=normalised)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError('Ein Standort mit diesem Namen existiert bereits.')

        return normalised

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        validated_data['user'] = user
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or instance.user_id != user.id:
            raise serializers.ValidationError('Dieser Standort gehört nicht zu deinem Konto.')
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().update(instance, validated_data)


class ItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemImage
        fields = ['id', 'item', 'image', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            self.fields['item'].queryset = Item.objects.filter(owner=request.user)
        else:
            self.fields['item'].queryset = Item.objects.none()


class ItemSerializer(serializers.ModelSerializer):
    tags = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Tag.objects.none())
    owner = serializers.ReadOnlyField(source='owner.id')
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    asset_tag = serializers.UUIDField(read_only=True)
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
            tags_qs = Tag.objects.filter(user=request.user)
            locations_qs = Location.objects.filter(user=request.user)
            tags_field.queryset = tags_qs
            if hasattr(tags_field, 'child_relation'):
                tags_field.child_relation.queryset = tags_qs
            location_field.queryset = locations_qs
        else:
            empty_tags = Tag.objects.none()
            tags_field.queryset = empty_tags
            if hasattr(tags_field, 'child_relation'):
                tags_field.child_relation.queryset = empty_tags
            empty_locations = Location.objects.none()
            location_field.queryset = empty_locations

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        location = attrs.get('location')
        if location and user and location.user_id != user.id:
            raise serializers.ValidationError({'location': 'Dieser Standort gehört nicht zu deinem Konto.'})

        tags = attrs.get('tags', [])
        if tags and user:
            invalid_tags = [tag for tag in tags if tag.user_id != user.id]
            if invalid_tags:
                raise serializers.ValidationError({'tags': 'Mindestens eines der ausgewählten Tags gehört einem anderen Benutzer.'})
        return attrs

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError('Menge muss mindestens 1 sein.')
        return value

    def validate_value(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Der Wert darf nicht negativ sein.')
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        tags = validated_data.pop('tags', [])
        owner = validated_data.pop('owner', user)
        item = Item.objects.create(owner=owner, **validated_data)
        if tags:
            item.tags.set([tag for tag in tags if not user or tag.user_id == user.id])
        return item

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags is not None:
            request = self.context.get('request')
            user = getattr(request, 'user', None)
            filtered_tags = [tag for tag in tags if not user or tag.user_id == user.id]
            instance.tags.set(filtered_tags)
        return instance


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

        items = validated_data.pop('items', [])
        owner = validated_data.pop('owner', user)
        item_list = ItemList.objects.create(owner=owner, **validated_data)
        if items:
            own_items = [item for item in items if not user or item.owner_id == user.id]
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
            request = self.context.get('request')
            user = getattr(request, 'user', None)
            filtered_items = [item for item in items if not user or item.owner_id == user.id]
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
