from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework.reverse import reverse
import mimetypes
import os

from .models import Item, ItemImage, ItemChangeLog, ItemList, Location, Tag, MAX_PURCHASE_AGE_YEARS


User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    """
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(), 
            lookup='iexact',
            message='Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte verwende eine andere E-Mail-Adresse oder melde dich mit deinem bestehenden Konto an.'
        )],
    )
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'password_confirm']
        read_only_fields = ['id']

    def validate(self, attrs):
        """
        Validates the serializer data.

        Args:
            attrs (dict): The data to validate.

        Returns:
            dict: The validated data.
        """
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)
        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Die Passwörter stimmen nicht überein.'})
        email = attrs.get('email')
        if email:
            attrs['email'] = email.strip().lower()
        try:
            validate_password(password)
        except ValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})
        except Exception as e:
            raise serializers.ValidationError({'password': 'Passwort entspricht nicht den Sicherheitsstandards.'})
        return attrs

    def create(self, validated_data):
        """
        Creates a new user.

        Args:
            validated_data (dict): The validated data.

        Returns:
            User: The created user.
        """
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        try:
            user.save()
        except Exception:
            # If save fails, we need to ensure password is not left in memory
            user = None
            password = None  # Clear password from memory
            raise
        return user


class TagSerializer(serializers.ModelSerializer):
    """
    Serializer for tags.
    """
    class Meta:
        model = Tag
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """
        Validates the name of the tag.

        Args:
            value (str): The name of the tag.

        Returns:
            str: The validated name.
        """
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
        """
        Creates a new tag.

        Args:
            validated_data (dict): The validated data.

        Returns:
            Tag: The created tag.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Updates an existing tag.

        Args:
            instance (Tag): The tag to update.
            validated_data (dict): The validated data.

        Returns:
            Tag: The updated tag.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or instance.user_id != user.id:
            raise serializers.ValidationError('Dieses Schlagwort gehört nicht zu deinem Konto.')
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().update(instance, validated_data)


class LocationSerializer(serializers.ModelSerializer):
    """
    Serializer for locations.
    """
    class Meta:
        model = Location
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """
        Validates the name of the location.

        Args:
            value (str): The name of the location.

        Returns:
            str: The validated name.
        """
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
        """
        Creates a new location.

        Args:
            validated_data (dict): The validated data.

        Returns:
            Location: The created location.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        validated_data['user'] = user
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Updates an existing location.

        Args:
            instance (Location): The location to update.
            validated_data (dict): The validated data.

        Returns:
            Location: The updated location.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or instance.user_id != user.id:
            raise serializers.ValidationError('Dieser Standort gehört nicht zu deinem Konto.')
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().update(instance, validated_data)


class ItemImageSerializer(serializers.ModelSerializer):
    """
    Serializer for item images.
    """
    download_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()
    content_type = serializers.SerializerMethodField()
    size = serializers.SerializerMethodField()

    class Meta:
        model = ItemImage
        fields = [
            'id',
            'item',
            'image',
            'download_url',
            'preview_url',
            'filename',
            'content_type',
            'size',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'download_url',
            'preview_url',
            'filename',
            'content_type',
            'size',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'image': {'write_only': True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            self.fields['item'].queryset = Item.objects.filter(owner=request.user)
        else:
            self.fields['item'].queryset = Item.objects.none()
    
    def validate_image(self, value):
        """
        Validate uploaded attachment file

        Args:
            value (File): The uploaded file.

        Returns:
            File: The validated file.
        """
        # Check file size (8MB max)
        max_size = 8 * 1024 * 1024  # 8MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError('Die Datei ist zu groß. Maximal 8 MB erlaubt.')

        # SECURITY FIX: Validate Content-Type (MIME type from HTTP header)
        # This prevents MIME confusion attacks where malicious files are renamed
        allowed_types = {
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/avif',
            'image/heic',
            'image/heif',
            'application/pdf',
        }
        
        content_type = value.content_type
        if content_type not in allowed_types:
            raise serializers.ValidationError(
                f'Ungültiger Dateityp: {content_type}. '
                'Nur Bild- oder PDF-Dateien sind erlaubt.'
            )

        # Additional check for file extension
        ext = os.path.splitext(value.name)[1].lower()
        allowed_extensions = {
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.bmp',
            '.avif',
            '.heic',
            '.heif',
            '.pdf',
        }
        if ext not in allowed_extensions:
            raise serializers.ValidationError('Ungültige Dateierweiterung. Erlaubt sind Bild- oder PDF-Dateien.')
        
        # SECURITY FIX: Cross-validate Content-Type against file extension
        # This prevents attacks where file extension doesn't match actual content
        content_to_ext = {
            'image/jpeg': {'.jpg', '.jpeg'},
            'image/jpg': {'.jpg', '.jpeg'},
            'image/png': {'.png'},
            'image/gif': {'.gif'},
            'image/webp': {'.webp'},
            'image/bmp': {'.bmp'},
            'image/avif': {'.avif'},
            'image/heic': {'.heic'},
            'image/heif': {'.heif'},
            'application/pdf': {'.pdf'},
        }
        
        expected_exts = content_to_ext.get(content_type, set())
        if ext not in expected_exts:
            raise serializers.ValidationError(
                f'Dateiendung {ext} passt nicht zum Dateityp {content_type}. '
                'Die Datei könnte manipuliert worden sein.'
            )

        return value

    def validate_item(self, value: Item) -> Item:
        """
        Validates the item.

        Args:
            value (Item): The item.

        Returns:
            Item: The validated item.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        if value.owner_id != user.id:
            raise serializers.ValidationError('Bilder können nur für eigene Gegenstände hinzugefügt werden.')
        return value

    def _build_download_url(self, obj: ItemImage, *, disposition: str | None = None) -> str:
        """
        Builds the download URL for the item image.

        Args:
            obj (ItemImage): The item image object.
            disposition (str, optional): The disposition of the file. Defaults to None.

        Returns:
            str: The download URL.
        """
        url = reverse('itemimage-download', args=[obj.pk])
        if disposition:
            return f"{url}?disposition={disposition}"
        return url

    def get_download_url(self, obj: ItemImage) -> str:
        """
        Gets the download URL for the item image.

        Args:
            obj (ItemImage): The item image object.

        Returns:
            str: The download URL.
        """
        return self._build_download_url(obj, disposition='attachment')

    def get_preview_url(self, obj: ItemImage) -> str:
        """
        Gets the preview URL for the item image.

        Args:
            obj (ItemImage): The item image object.

        Returns:
            str: The preview URL.
        """
        return self._build_download_url(obj, disposition='inline')

    def get_filename(self, obj: ItemImage) -> str:
        """
        Gets the filename of the item image.

        Args:
            obj (ItemImage): The item image object.

        Returns:
            str: The filename.
        """
        if not obj.image or not obj.image.name:
            return ''
        return os.path.basename(obj.image.name)

    def get_content_type(self, obj: ItemImage) -> str:
        """
        Gets the content type of the item image.

        Args:
            obj (ItemImage): The item image object.

        Returns:
            str: The content type.
        """
        if not obj.image or not obj.image.name:
            return 'application/octet-stream'
        try:
            file_obj = getattr(obj.image, 'file', None)
            content_type = getattr(file_obj, 'content_type', None)
            if content_type:
                return content_type
        except (OSError, IOError, FileNotFoundError):
            pass
        guessed, _ = mimetypes.guess_type(obj.image.name)
        return guessed or 'application/octet-stream'

    def get_size(self, obj: ItemImage) -> int:
        """
        Gets the size of the item image.

        Args:
            obj (ItemImage): The item image object.

        Returns:
            int: The size of the image in bytes.
        """
        if not obj.image or not obj.image.name:
            return 0
        try:
            return obj.image.size
        except (OSError, ValueError, FileNotFoundError):
            return 0


class ItemSerializer(serializers.ModelSerializer):
    """
    Serializer for items.
    """
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
            # For unauthenticated users, ensure all sensitive data is hidden
            user = None
            empty_tags = Tag.objects.none()
            tags_field.queryset = empty_tags
            if hasattr(tags_field, 'child_relation'):
                tags_field.child_relation.queryset = empty_tags
            empty_locations = Location.objects.none()
            location_field.queryset = empty_locations

    def _require_user(self) -> User:
        """
        Gets the user from the request context.

        Returns:
            User: The user.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        return user

    def validate(self, attrs):
        """
        Validates the serializer data.

        Args:
            attrs (dict): The data to validate.

        Returns:
            dict: The validated data.
        """
        user = self._require_user()

        location = attrs.get('location')
        if location and location.user_id != user.id:
            raise serializers.ValidationError({'location': 'Dieser Standort gehört nicht zu deinem Konto.'})

        tags = attrs.get('tags', [])
        if tags:
            invalid_tags = [tag for tag in tags if tag.user_id != user.id]
            if invalid_tags:
                raise serializers.ValidationError({'tags': 'Mindestens eines der ausgewählten Tags gehört einem anderen Benutzer.'})
        return attrs

    def validate_purchase_date(self, value):
        """
        Validates the purchase date.

        Args:
            value (date): The purchase date.

        Returns:
            date: The validated purchase date.
        """
        if value is None:
            return value

        # Validate that purchase date is not in the future
        from datetime import date
        if value > date.today():
            raise serializers.ValidationError('Das Kaufdatum darf nicht in der Zukunft liegen.')

        # Validate that purchase date is not too far in the past (reasonable limit)
        from datetime import date, timedelta
        min_date = date.today() - timedelta(days=365 * MAX_PURCHASE_AGE_YEARS)  # 50 years ago
        if value < min_date:
            raise serializers.ValidationError('Das Kaufdatum ist zu alt. Maximal 50 Jahre zurück.')

        return value

    def validate_value(self, value):
        """
        Validates the value.

        Args:
            value (Decimal): The value.

        Returns:
            Decimal: The validated value.
        """
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Der Wert darf nicht negativ sein.')
        if value > 999999999.99:  # Reasonable upper limit for currency
            raise serializers.ValidationError('Der Wert ist zu hoch. Maximal 999.999.999,99 € erlaubt.')

        # Check for reasonable decimal places (max 2)
        # Convert to string to handle both float and Decimal types
        value_str = str(value)
        if '.' in value_str:
            decimal_part = value_str.split('.')[-1]
            if len(decimal_part) > 2:
                raise serializers.ValidationError('Der Wert darf maximal 2 Dezimalstellen haben.')

        return value

    def _normalise_payload(self, data: dict) -> dict:
        """
        Normalises the payload data.

        Args:
            data (dict): The payload data.

        Returns:
            dict: The normalised payload data.
        """
        # Convert empty strings to None for nullable fields
        if 'description' in data and (data['description'] is None or data['description'] == ''):
            data['description'] = None
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
        return data

    def create(self, validated_data):
        """
        Creates a new item.

        Args:
            validated_data (dict): The validated data.

        Returns:
            Item: The created item.
        """
        user = self._require_user()
        tags = validated_data.pop('tags', [])
        validated_data.pop('owner', None)
        normalised = self._normalise_payload(validated_data)
        item = Item.objects.create(owner=user, **normalised)
        if tags:
            item.tags.set([tag for tag in tags if tag.user_id == user.id])
        return item

    def update(self, instance, validated_data):
        """
        Updates an existing item.

        Args:
            instance (Item): The item to update.
            validated_data (dict): The validated data.

        Returns:
            Item: The updated item.
        """
        user = self._require_user()
        tags = validated_data.pop('tags', None)
        normalised = self._normalise_payload(validated_data)

        allowed_fields = {
            'name',
            'description',
            'quantity',
            'purchase_date',
            'value',
            'location',
            'wodis_inventory_number',
        }
        for field in list(normalised.keys()):
            if field not in allowed_fields:
                normalised.pop(field)

        for attr, value in normalised.items():
            setattr(instance, attr, value)
        instance.save()

        if tags is not None:
            instance.tags.set([tag for tag in tags if tag.user_id == user.id])
        return instance


class ItemListSerializer(serializers.ModelSerializer):
    """
    Serializer for item lists.
    """
    items = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Item.objects.none())
    owner = serializers.ReadOnlyField(source='owner.id')

    class Meta:
        model = ItemList
        fields = ['id', 'name', 'owner', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def validate_name(self, value):
        """
        Validates the name of the item list.

        Args:
            value (str): The name of the item list.

        Returns:
            str: The validated name.
        """
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
        """
        Gets the user from the request context.

        Returns:
            User: The user.
        """
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
        """
        Creates a new item list.

        Args:
            validated_data (dict): The validated data.

        Returns:
            ItemList: The created item list.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        user = self._require_user()

        items = validated_data.pop('items', [])
        # Always use the authenticated user as owner, ignore any provided owner value
        validated_data.pop('owner', None)  # Remove owner if present in validated_data
        item_list = ItemList.objects.create(owner=user, **validated_data)
        if items:
            own_items = [item for item in items if item.owner_id == user.id]
            item_list.items.set(own_items)
        return item_list

    def update(self, instance, validated_data):
        """
        Updates an existing item list.

        Args:
            instance (ItemList): The item list to update.
            validated_data (dict): The validated data.

        Returns:
            ItemList: The updated item list.
        """
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
        """
        Validates the items in the item list.

        Args:
            value (list): The list of items.

        Returns:
            list: The validated list of items.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user:
            invalid_items = [item for item in value if item.owner_id != user.id]
            if invalid_items:
                raise serializers.ValidationError('Listen können nur eigene Gegenstände enthalten.')
        return value


class ItemChangeLogSerializer(serializers.ModelSerializer):
    """
    Serializer for item change logs.
    """
    user_username = serializers.CharField(source='user.username', read_only=True, default=None)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._location_cache: dict[int, str] = {}

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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        changes = data.get('changes')
        if isinstance(changes, dict):
            location_change = changes.get('location_id')
            if isinstance(location_change, dict):
                for key in ('old', 'new'):
                    location_change[key] = self._resolve_location_name(location_change.get(key))
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
