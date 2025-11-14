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
from .models import Item, ItemImage, ItemChangeLog, ItemList, Location, Tag, MAX_PURCHASE_AGE_YEARS

# Get the User model (either Django's default or custom model)
User = get_user_model()

# =========================
# USER REGISTRATION SERIALIZER
# =========================

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration endpoint.

    Handles new user account creation with comprehensive validation:
    - Email uniqueness checking (case-insensitive)
    - Password strength validation using Django's validators
    - Password confirmation matching
    - Secure password storage using hashing

    Security features:
    - Passwords are write-only (never returned in API responses)
    - Email normalization (lowercase, trimmed)
    - Comprehensive error messages in German
    """

    # Email field with unique validation (case-insensitive)
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            lookup='iexact',  # Case-insensitive uniqueness check
            message='Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte verwende eine andere E-Mail-Adresse oder melde dich mit deinem bestehenden Konto an.'
        )],
    )

    # Password field (write-only for security)
    password = serializers.CharField(write_only=True)

    # Password confirmation field (write-only, not stored in database)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # Fields exposed in the API
        fields = ['id', 'username', 'email', 'password', 'password_confirm']
        # ID is auto-generated, cannot be set by client
        read_only_fields = ['id']

    def validate(self, attrs):
        """
        Validate user registration data.

        Performs several validation checks:
        1. Password and password_confirm must match
        2. Email is normalized (lowercase, trimmed)
        3. Password meets Django's security requirements

        Args:
            attrs: Dictionary of field values from the request

        Returns:
            dict: Validated and normalized attributes

        Raises:
            serializers.ValidationError: If validation fails
        """
        # Extract passwords for validation
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)

        # Ensure passwords match
        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Die Passwörter stimmen nicht überein.'})

        # Normalize email (lowercase and trim whitespace)
        email = attrs.get('email')
        if email:
            attrs['email'] = email.strip().lower()

        # Validate password strength using Django's validators
        # This checks for: minimum length, common passwords, numeric-only, similarity to user attributes
        try:
            validate_password(password)
        except ValidationError as e:
            # Django validation errors - convert to DRF format
            raise serializers.ValidationError({'password': list(e.messages)})
        except Exception as e:
            # Unexpected errors - return generic message
            raise serializers.ValidationError({'password': 'Passwort entspricht nicht den Sicherheitsstandards.'})

        return attrs

    def create(self, validated_data):
        """
        Create a new user account.

        Extracts the password, creates the user object, and properly hashes
        the password using Django's secure password hashing.

        Args:
            validated_data: Validated data from validate() method

        Returns:
            User: The newly created user instance

        Raises:
            Exception: If user creation fails (re-raised after cleanup)
        """
        # Extract password from validated data
        password = validated_data.pop('password')

        # Create user object (without password yet)
        user = User(**validated_data)

        # Hash and set the password securely
        # Django uses Argon2 by default (configured in settings.py)
        user.set_password(password)

        try:
            # Save user to database
            user.save()
        except Exception:
            # If save fails, clean up sensitive data from memory
            user = None
            password = None
            raise  # Re-raise the exception

        return user

# =========================
# TAG SERIALIZER
# =========================

class TagSerializer(serializers.ModelSerializer):
    """
    Serializer for Tag model.

    Handles creation, updating, and retrieval of user-defined tags for categorizing items.

    Security features:
    - User isolation: Users can only see/modify their own tags
    - Duplicate prevention: Case-insensitive uniqueness check per user
    - Name normalization: Trim whitespace from tag names

    Validation:
    - Tag names must be unique per user (case-insensitive)
    - Empty or whitespace-only names are rejected
    - Tags are automatically associated with the authenticated user
    """

    class Meta:
        model = Tag
        # Fields exposed in the API
        fields = ['id', 'name', 'created_at', 'updated_at']
        # These fields cannot be set by clients
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """
        Validate tag name for uniqueness and format.

        Ensures tag names are unique per user (case-insensitive) and properly formatted.

        Args:
            value: The tag name to validate

        Returns:
            str: Normalized tag name (trimmed whitespace)

        Raises:
            serializers.ValidationError: If tag name already exists for this user
        """
        # Get the current user from request context
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # Normalize the tag name (remove leading/trailing whitespace)
        normalised = value.strip()

        # If user is not authenticated, just return normalized value
        # (will fail at create/update due to permission checks)
        if not user or not user.is_authenticated:
            return normalised

        # Check if user already has a tag with this name (case-insensitive)
        queryset = Tag.objects.filter(user=user, name__iexact=normalised)

        # If updating an existing tag, exclude it from the uniqueness check
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        # Raise error if duplicate found
        if queryset.exists():
            raise serializers.ValidationError('Ein Schlagwort mit diesem Namen existiert bereits.')

        return normalised

    def create(self, validated_data):
        """
        Create a new tag for the authenticated user.

        Automatically associates the tag with the current user.

        Args:
            validated_data: Validated data from the serializer

        Returns:
            Tag: The newly created tag instance

        Raises:
            serializers.ValidationError: If user is not authenticated
        """
        # Get the current user from request context
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # Ensure user is authenticated
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')

        # Associate tag with the current user
        validated_data['user'] = user

        # Create the tag
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Update an existing tag.

        Ensures users can only update their own tags.

        Args:
            instance: The existing Tag instance to update
            validated_data: Validated data from the serializer

        Returns:
            Tag: The updated tag instance

        Raises:
            serializers.ValidationError: If user doesn't own this tag
        """
        # Get the current user from request context
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # Ensure the tag belongs to the current user
        if not user or instance.user_id != user.id:
            raise serializers.ValidationError('Dieses Schlagwort gehört nicht zu deinem Konto.')

        # Normalize name if being updated
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()

        # Update the tag
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

        max_size = 8 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Die Datei ist zu groß. Maximal 8 MB erlaubt.')

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
        
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentifizierung erforderlich.')
        if value.owner_id != user.id:
            raise serializers.ValidationError('Bilder können nur für eigene Gegenstände hinzugefügt werden.')
        return value

    def _build_download_url(self, obj: ItemImage, *, disposition: str | None = None) -> str:
        
        url = reverse('itemimage-download', args=[obj.pk])
        if disposition:
            return f"{url}?disposition={disposition}"
        return url

    def get_download_url(self, obj: ItemImage) -> str:
        
        return self._build_download_url(obj, disposition='attachment')

    def get_preview_url(self, obj: ItemImage) -> str:
        
        return self._build_download_url(obj, disposition='inline')

    def get_filename(self, obj: ItemImage) -> str:
        
        if not obj.image or not obj.image.name:
            return ''
        return os.path.basename(obj.image.name)

    def get_content_type(self, obj: ItemImage) -> str:
        
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
        
        if not obj.image or not obj.image.name:
            return 0
        try:
            return obj.image.size
        except (OSError, ValueError, FileNotFoundError):
            return 0

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
                raise serializers.ValidationError({'tags': 'Mindestens eines der ausgewählten Tags gehört einem anderen Benutzer.'})
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
