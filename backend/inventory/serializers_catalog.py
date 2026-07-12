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
    """
    Serializer for Location model.

    Handles creation, updating, and retrieval of storage locations for items.

    Security features:
    - User isolation: Users can only see/modify their own locations
    - Duplicate prevention: Case-insensitive uniqueness check per user
    - Name normalization: Trim whitespace from location names

    Validation:
    - Location names must be unique per user (case-insensitive)
    - Empty or whitespace-only names are rejected
    - Locations are automatically associated with the authenticated user
    """

    class Meta:
        """Meta configuration for LocationSerializer."""
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
