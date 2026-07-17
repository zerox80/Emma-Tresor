# EmmaTresor Inventory Models
# ===========================
# This module defines the core data models for the EmmaTresor inventory management system.
# It includes models for items, images, tags, locations, change tracking, and user lists.
#
# The models implement:
# - User data isolation (each user only sees their own data)
# - Comprehensive audit trails with change logging
# - Secure file handling with custom storage backends
# - Image validation and security controls
# - Integration with external inventory systems
# - QR code generation support via UUID asset tags

from django.conf import settings                    # Django settings for AUTH_USER_MODEL
from django.core.exceptions import ValidationError # Custom validation exceptions
from django.core.validators import MinValueValidator, MaxValueValidator  # Field validators
from django.db import models, IntegrityError, transaction  # Django ORM and database integrity
from django.db.models import Q
from datetime import date, timedelta               # Date operations for validation
from PIL import Image, UnidentifiedImageError     # Image processing for validation
import os                                         # Operating system operations
import uuid                                       # UUID generation for asset tags

# =========================
# SECURITY CONFIGURATION
# =========================

# Set PIL's maximum image pixels to prevent decompression bomb attacks
# This limits image processing to prevent DoS attacks through extremely large images
# 16,777,216 pixels = 4096x4096 pixels maximum (safe limit for memory usage)
Image.MAX_IMAGE_PIXELS = 16777216

# Import custom storage backend for secure file handling
# This provides private storage that doesn't expose files via direct URLs
try:
    from .storage import private_item_storage
except ImportError as exc:
    raise ImportError('Private storage backend not available') from exc

# =========================
# BASE MODELS
# =========================

class TimeStampedModel(models.Model):
    """
    Abstract base model that provides timestamp fields for tracking creation and updates.

    All main models in this system inherit from this to automatically track:
    - created_at: When the record was first created (immutable, set only once)
    - updated_at: When the record was last modified (auto-updated on every save)

    This is a Django pattern for implementing soft timestamps without manually managing them.
    """

    # Automatically set to the current date/time when the object is first created
    # auto_now_add=True means this field is set only during creation and never updated
    created_at = models.DateTimeField(auto_now_add=True)

    # Automatically updated to the current date/time every time the object is saved
    # auto_now=True means this field is updated on every save operation
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Mark this as an abstract model - Django won't create a database table for it
        # Other models can inherit these fields without creating a separate table
        abstract = True

# =========================
# ORGANIZATION MODELS
# =========================

class Tag(TimeStampedModel):
    """
    User-defined tags for categorizing inventory items.

    Tags allow users to organize items by custom categories
    (e.g., "Electronics", "Office Supplies", "Tools", "Critical Assets").
    Each user has their own set of tags to ensure data privacy and isolation.

    Features:
    - User-scoped (each user sees only their own tags)
    - Unique names per user (no duplicates within user's tag set)
    - Alphabetical sorting for better UX
    - German verbose names for German UI
    """

    # Tag name with maximum length of 100 characters
    # CharField is used instead of TextField for performance and to enforce length limits
    name = models.CharField(max_length=100)

    # Foreign key to the user who owns this tag
    # CASCADE deletion means if a user is deleted, all their tags are also deleted
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,           # Use the configured user model (not hardcoded User)
        on_delete=models.CASCADE,            # Delete tags when user is deleted
        related_name='tags',                 # Access user's tags via user.tags.all()
        help_text='The user who owns this tag'
    )

    class Meta:
        # Ensure each user cannot have duplicate tag names
        # This creates a database constraint on (user_id, name) combination
        unique_together = ('user', 'name')

        # Default ordering for queries - sort tags alphabetically by name
        ordering = ['name']

        # German verbose names for the Django admin interface
        verbose_name = 'Schlagwort'          # German: "Keyword/Tag"
        verbose_name_plural = 'Schlagwörter' # German: "Keywords/Tags"

    def __str__(self) -> str:
        """String representation of the tag - used in Django admin and debugging."""
        return self.name

class Location(TimeStampedModel):
    """
    Physical storage locations for inventory items.

    Locations represent physical places where items are stored
    (e.g., "Office Building A", "Warehouse 3", "Desk Drawer", "Server Room").
    Each user has their own set of locations to maintain data privacy.

    Features:
    - User-scoped for data isolation
    - Unique names per user to prevent confusion
    - Optional association with items (items can exist without location)
    - Hierarchical naming supported (e.g., "Building A > Floor 2 > Room 201")
    """

    # Location name with maximum length of 100 characters
    name = models.CharField(max_length=100)

    # Foreign key to the user who owns this location
    # CASCADE deletion ensures data consistency when users are removed
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,           # Use the configured user model
        on_delete=models.CASCADE,            # Delete locations when user is deleted
        related_name='locations',            # Access user's locations via user.locations.all()
        help_text='The user who owns this location'
    )

    class Meta:
        # Ensure each user cannot have duplicate location names
        unique_together = ('user', 'name')

        # Default ordering - sort locations alphabetically by name
        ordering = ['name']

        # German verbose names for Django admin
        verbose_name = 'Standort'            # German: "Location"
        verbose_name_plural = 'Standorte'    # German: "Locations"

    def __str__(self) -> str:
        """String representation of the location."""
        return self.name

# =========================
# CONSTANTS AND VALIDATION
# =========================

# Maximum allowed age for purchase dates (50 years) to prevent data entry errors
# This prevents users from entering extremely old dates that might be data entry mistakes
MAX_PURCHASE_AGE_YEARS = 50

# =========================
# CORE INVENTORY MODELS
# =========================

class Item(TimeStampedModel):
    """
    Core inventory item model - the central entity of the system.

    Represents a single inventory item with comprehensive tracking including:
    - Basic information: name, description, quantity
    - Financial data: purchase date, monetary value
    - Unique identifiers: UUID asset tag for QR codes, external inventory numbers
    - Organization: location, tags for categorization
    - Ownership: user-specific isolation for privacy and security

    Security Features:
    - UUID-based asset tags prevent enumeration attacks
    - User-scoped data ensures privacy
    - Comprehensive validation prevents data corruption
    - Change logging provides audit trail
    """

    # Item name - required field with reasonable length limit
    name = models.CharField(max_length=255)

    # Detailed description - optional rich text field
    # Both blank=True and null=True allow empty values in database and forms
    description = models.TextField(blank=True, null=True)

    # Quantity of items - must be at least 1, maximum 999,999
    # PositiveIntegerField ensures no negative quantities
    quantity = models.PositiveIntegerField(
        default=1,                                   # Default to 1 item
        validators=[                                  # Database and form level validation
            MinValueValidator(1),                     # Minimum 1 item
            MaxValueValidator(999999)                  # Maximum 999,999 items
        ]
    )

    # Purchase date - optional field for tracking when item was acquired
    # DateField stores dates without time component
    purchase_date = models.DateField(blank=True, null=True)

    # Monetary value - optional field for insurance and accounting purposes
    # DecimalField provides exact monetary precision (avoiding float rounding errors)
    # max_digits=12, decimal_places=2 supports values up to 9,999,999,999.99
    value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)

    # Unique identifier for each item, used for QR codes and asset tracking
    # UUIDField provides cryptographically secure random identifiers
    asset_tag = models.UUIDField(
        default=uuid.uuid4,                    # Generate UUID4 (random) when item is created
        editable=False,                       # Cannot be manually changed in forms
        unique=True,                          # Must be unique across all items in database
        db_index=True,                        # Create database index for fast lookups
    )

    # User ownership - ensures data privacy and isolation between users
    # This is the key field that implements multi-tenancy
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,               # Use configured user model
        on_delete=models.CASCADE,                # Delete items when user is deleted
        related_name='items',                    # Access user's items via user.items.all()
    )

    # Physical location where the item is stored
    # SET_NULL means if location is deleted, item remains but location becomes null
    location = models.ForeignKey(
        'Location',                             # String reference to avoid circular import
        on_delete=models.SET_NULL,               # Keep item if location is deleted
        null=True,                               # Database allows NULL values
        blank=True,                              # Forms allow empty values
        related_name='items',                      # Access location's items via location.items.all()
    )

    # Integration with external inventory system (Wodis)
    # Optional field for linking to existing inventory systems
    wodis_inventory_number = models.CharField(
        max_length=120,                         # Reasonable length for inventory numbers
        blank=True,                             # Allow empty values
        null=True,                               # Database allows NULL
        db_index=True,                           # Index for fast lookups by inventory number
        help_text='Optionale Inventarnummer aus Wodis',  # German help text for admin
    )

    # Many-to-many relationship with tags for categorization
    # Items can have multiple tags, tags can be applied to multiple items
    tags = models.ManyToManyField('Tag', related_name='items', blank=True)

    # Employee assignment - optional field for tracking which employee the item belongs to
    # Useful for tracking equipment assignments to specific personnel
    employee_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text='Name des Mitarbeiters, dem der Gegenstand zugeordnet ist'
    )

    # Room number - optional field for tracking which room/space the item is in
    # Provides more precise location information beyond the general Location field
    room_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Raumnummer, in der sich der Gegenstand befindet'
    )

    class Meta:
        # Default ordering for queries - sort items alphabetically by name
        ordering = ['name']

        # German verbose names for Django admin interface
        verbose_name = 'Gegenstand'              # German: "Item/Object"
        verbose_name_plural = 'Gegenstände'      # German: "Items/Objects"

        # Database indexes for improved query performance
        indexes = [
            models.Index(fields=['wodis_inventory_number']),  # Fast searches by inventory number
        ]

    def clean(self):
        """
        Comprehensive validation of item data before saving.

        This method is called by Django's ModelForm validation and full_clean().
        It performs business logic validation beyond database constraints.

        Validations performed:
        - Purchase date cannot be in future or too far in past
        - Value must be non-negative and within reasonable bounds
        - Inventory number is cleaned of whitespace
        """
        super().clean()

        # Validate purchase date
        if self.purchase_date:
            # Purchase date cannot be in the future
            if self.purchase_date > date.today():
                raise ValidationError({'purchase_date': 'Das Kaufdatum darf nicht in der Zukunft liegen.'})

            # Purchase date cannot be too far in the past (prevents data entry errors)
            min_date = date.today() - timedelta(days=365 * MAX_PURCHASE_AGE_YEARS)
            if self.purchase_date < min_date:
                raise ValidationError({
                    'purchase_date': f'Das Kaufdatum ist zu alt. Maximal {MAX_PURCHASE_AGE_YEARS} Jahre zurück.'
                })

        # Validate monetary value
        if self.value is not None:
            # Value cannot be negative
            if self.value < 0:
                raise ValidationError({'value': 'Der Wert darf nicht negativ sein.'})

            # Value has reasonable upper bound (prevents data entry errors)
            if self.value > 999999999.99:
                raise ValidationError({'value': 'Der Wert ist zu hoch. Maximal 999.999.999,99 € erlaubt.'})

        # Clean inventory number (remove leading/trailing whitespace)
        if self.wodis_inventory_number is not None:
            cleaned = str(self.wodis_inventory_number).strip()
            # Convert empty string back to None for consistency
            self.wodis_inventory_number = cleaned or None

    def save(self, *args, **kwargs):
        """
        Override save method to handle UUID collision retry logic.

        In extremely rare cases, UUID generation might collide with existing UUIDs.
        This method implements retry logic to handle such collisions gracefully.

        Args:
            *args: Positional arguments passed to parent save method
            **kwargs: Keyword arguments passed to parent save method
                      - max_uuid_attempts: Maximum number of UUID generation retries
        """
        # Extract max attempts from kwargs (default to 5 if not specified)
        max_attempts = kwargs.pop('max_uuid_attempts', 5)
        attempt = 0

        while True:
            # Validate all fields before saving
            self.full_clean()
            try:
                # Keep the row write and its audit signal in one transaction so
                # an audit failure cannot leave an unlogged change behind.
                with transaction.atomic():
                    super().save(*args, **kwargs)
                return  # Success - exit the retry loop
            except IntegrityError as exc:
                # Check if the error is related to asset_tag uniqueness
                if 'asset_tag' not in str(exc).lower():
                    # If it's a different integrity error, re-raise it
                    raise

                # If it's a UUID collision, retry with a new UUID
                attempt += 1
                if attempt >= max_attempts:
                    # If we've exceeded max attempts, give up and raise the error
                    raise

                # Generate a new UUID and try again
                self.asset_tag = uuid.uuid4()

    def __str__(self) -> str:
        """String representation of the item - used in admin and debugging."""
        return self.name
