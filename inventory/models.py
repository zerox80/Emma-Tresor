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
from django.db import models, IntegrityError       # Django ORM and database integrity
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
                # Attempt to save the item
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

class ItemImage(TimeStampedModel):
    """
    Images and attachments for inventory items.

    This model handles file uploads for item documentation, photos, and attachments.
    It implements comprehensive security measures to prevent malicious file uploads.

    Security Features:
    - File type validation (only images and PDFs allowed)
    - File size limits (8MB maximum)
    - Image dimension limits (prevents decompression bombs)
    - Pixel count limits (prevents DoS attacks)
    - Private storage backend (files not directly accessible via URLs)
    - Comprehensive image validation and processing

    Supported Formats:
    - Images: JPG, JPEG, PNG, GIF, WebP, BMP, AVIF, HEIC, HEIF
    - Documents: PDF
    """

    # Foreign key to the associated item
    # CASCADE deletion means if item is deleted, all its images are also deleted
    item = models.ForeignKey(
        'Item',                                  # String reference to avoid circular import
        on_delete=models.CASCADE,                  # Delete images when item is deleted
        related_name='images',                      # Access item's images via item.images.all()
    )

    # File field that stores the uploaded file
    # Uses private storage backend for security (files not publicly accessible)
    image = models.FileField(
        upload_to='item_attachments/',             # Storage path within private storage
        storage=private_item_storage               # Custom private storage backend
    )

    class Meta:
        # German verbose names for Django admin
        verbose_name = 'Gegenstandsbild'         # German: "Item Image"
        verbose_name_plural = 'Gegenstandsbilder' # German: "Item Images"

    def __str__(self) -> str:
        """String representation of the image."""
        return f"Bild für {self.item.name}"

    def clean(self):
        """
        Comprehensive file validation for security and integrity.

        This method performs multiple layers of validation to ensure uploaded files are safe:
        1. File size validation (8MB limit)
        2. File extension validation (whitelist approach)
        3. Content-type validation (actual file content checking)
        4. Image validation (dimensions, pixel count, format compatibility)
        5. Security checks (decompression bomb prevention)

        Raises:
            ValidationError: If any validation fails with descriptive German error messages
        """
        super().clean()

        # Skip validation if no file is uploaded
        if not self.image:
            return

        # === FILE SIZE VALIDATION ===
        # Maximum file size: 8MB (8 * 1024 * 1024 bytes)
        max_size = 8 * 1024 * 1024
        if self.image.size > max_size:
            raise ValidationError('Die Datei ist zu groß. Maximal 8 MB erlaubt.')

        # === FILE EXTENSION VALIDATION ===
        # Whitelist of allowed file extensions (security by whitelist, not blacklist)
        allowed_extensions = {
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic', '.heif', '.pdf'
        }
        ext = os.path.splitext(self.image.name)[1].lower()
        if ext not in allowed_extensions:
            raise ValidationError('Ungültige Dateierweiterung. Erlaubt sind Bild- oder PDF-Dateien.')

        # === CONTENT VALIDATION ===
        # Get file object for content validation
        file_obj = self.image.file
        
        # Remember current position to restore later
        pos = file_obj.tell()

        # Security constants
        MAX_PIXELS = 16777216           # 4096x4096 pixels maximum
        MAX_DIMENSION = 8192            # Maximum width or height in pixels
        MAX_FILE_SIZE_MB = 8             # Maximum file size in MB

        try:
            # Seek to beginning of file
            file_obj.seek(0)
            
            # Read first 16 bytes for file type detection
            header = file_obj.read(16)
            file_obj.seek(0)

            # === PDF VALIDATION ===
            if ext == '.pdf':
                # Check if file starts with PDF signature
                if not header.startswith(b'%PDF'):
                    raise ValidationError('Die Datei ist kein gültiges PDF-Dokument.')
            
            # === IMAGE VALIDATION ===
            else:
                try:
                    # Reset file position for image processing
                    file_obj.seek(0)

                    # Open image with PIL for validation
                    with Image.open(file_obj) as img:
                        # === DIMENSION VALIDATION ===
                        if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
                            raise ValidationError(
                                f'Bildabmessungen zu groß: {img.width}x{img.height}. '
                                f'Maximum: {MAX_DIMENSION}x{MAX_DIMENSION} Pixel.'
                            )

                        # === PIXEL COUNT VALIDATION ===
                        pixel_count = img.width * img.height
                        if pixel_count > MAX_PIXELS:
                            raise ValidationError(
                                f'Bild hat zu viele Pixel: {pixel_count}. '
                                f'Maximum: {MAX_PIXELS} Pixel (ca. 4096x4096).'
                            )

                        # Verify image integrity
                        img.verify()

                        # Reset file position again for final validation
                        file_obj.seek(0)

                        try:
                            # === FINAL IMAGE VALIDATION ===
                            # Re-open image for final check (verify() closes the image)
                            with Image.open(file_obj) as img_final:
                                # Load the image data (this can catch additional issues)
                                img_final.load()

                                # Re-check pixel count after loading
                                if img_final.width * img_final.height > MAX_PIXELS:
                                    raise ValidationError(
                                        f'Bild verarbeitet zu viele Pixel: {img_final.width}x{img_final.height}. '
                                        f'Limit überschritten.'
                                    )

                                # === COLOR MODE VALIDATION ===
                                # Check for transparency modes that might not be supported in all formats
                                if img_final.mode in ('LA', 'RGBA', 'RGBX', 'RGBa'):
                                    # Transparency modes require specific file formats
                                    if ext.lower() not in ['.png', '.webp', '.gif']:
                                        raise ValidationError(
                                            f'Farbmodus {img_final.mode} für Format {ext} nicht unterstützt.'
                                        )
                        
                        except MemoryError:
                            # Handle memory exhaustion during image processing
                            raise ValidationError(
                                'Bild zu groß für Verarbeitung (Speicherlimit überschritten). '
                                f'Maximum: {MAX_DIMENSION}x{MAX_DIMENSION} Pixel.'
                            )
                        
                        except Image.DecompressionBombError:
                            # Handle PIL's built-in decompression bomb detection
                            raise ValidationError(
                                'Potenzieller Decompression-Bomb-Angriff erkannt. '
                                f'Bild überschreitet Sicherheitslimit von {MAX_PIXELS} Pixeln.'
                            )
                        
                        except Exception as processing_error:
                            # Handle unexpected image processing errors
                            import logging
                            logger = logging.getLogger(__name__)
                            logger.warning(f'Image processing error: {type(processing_error).__name__}')
                            raise ValidationError('Bildverarbeitung fehlgeschlagen. Bitte verwende ein anderes Bild.') from processing_error
                                
                except (UnidentifiedImageError, OSError) as exc:
                    # Handle cases where file is not a valid image
                    raise ValidationError('Die Datei ist kein gültiges Bild.') from exc
                
                finally:
                    # Always reset file position
                    file_obj.seek(0)
        
        finally:
            # Ensure file position is restored even if validation fails
            file_obj.seek(pos)

    def save(self, *args, **kwargs):
        """
        Override save to ensure validation is performed before saving.

        This ensures that all security validations are run every time an image is saved,
        whether through the admin interface, API, or direct model operations.
        """
        # Run all validations before saving
        self.full_clean()
        # Call parent save method
        super().save(*args, **kwargs)

class ItemChangeLog(TimeStampedModel):
    """
    Audit trail model for tracking all changes to inventory items.

    This model implements a comprehensive audit system that records:
    - Item creation (when items are first added)
    - Item updates (when fields are modified)
    - Item deletion (when items are removed)
    - Who made the change (user attribution)
    - What changed (detailed field-level changes)
    - When the change occurred (timestamps)

    This is essential for:
    - Security auditing and compliance
    - Troubleshooting and debugging
    - Data recovery and rollback
    - User activity monitoring
    """

    # Action type constants
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'

    # Action choices for the action field
    ACTION_CHOICES = (
        ('create', 'Erstellung'),        # German: "Creation"
        ('update', 'Aktualisierung'),    # German: "Update"
        ('delete', 'Löschung'),         # German: "Deletion"
    )

    # Foreign key to the item that was changed
    # SET_NULL allows the log entry to remain even if the item is deleted
    item = models.ForeignKey(
        'Item',                                  # String reference to avoid circular import
        on_delete=models.SET_NULL,                 # Keep log entry if item is deleted
        related_name='change_logs',                # Access item's logs via item.change_logs.all()
        null=True,                                # Database allows NULL (for deleted items)
        blank=True,                               # Forms allow empty values
    )

    # Store item name separately (for deleted items where item foreign key is NULL)
    item_name = models.CharField(max_length=255, blank=True)

    # User who made the change
    # SET_NULL keeps the log entry even if user account is deleted
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,                   # Use configured user model
        on_delete=models.SET_NULL,                 # Keep log if user is deleted
        null=True,                                # Database allows NULL
        blank=True,                               # Forms allow empty values
        related_name='item_change_logs',           # Access user's logs via user.item_change_logs.all()
    )

    # Type of action performed on the item
    action = models.CharField(
        max_length=12,                            # Maximum length for action strings
        choices=ACTION_CHOICES                     # Dropdown with predefined choices
    )

    # Detailed changes in JSON format
    # Stores field-level changes: {"field_name": {"old": "old_value", "new": "new_value"}}
    # Empty dict for creation/deletion, detailed dict for updates
    changes = models.JSONField(blank=True, default=dict)

    class Meta:
        # Default ordering - most recent changes first (descending by creation time)
        ordering = ['-created_at']

        # German verbose names for Django admin
        verbose_name = 'Änderungsprotokoll'           # German: "Change Log"
        verbose_name_plural = 'Änderungsprotokolle'   # German: "Change Logs"

        # Database indexes for performance
        indexes = [
            # Index for item-specific change history queries
            models.Index(fields=['item', '-created_at']),
            
            # Index for user-specific activity queries
            models.Index(fields=['user', '-created_at']),
            
            # Index for action-type filtering
            models.Index(fields=['action', '-created_at']),
        ]

    def clean(self):
        """
        Validate action field to ensure only valid actions are recorded.
        """
        super().clean()
        
        # Get list of valid action values from choices
        valid_actions = [choice[0] for choice in self.ACTION_CHOICES]
        
        # Validate that the action is one of the allowed values
        if self.action not in valid_actions:
            raise ValidationError(
                f'Ungültige Aktion: {self.action}. Erlaubt sind: {", ".join(valid_actions)}'
            )

    def save(self, *args, **kwargs):
        """
        Override save to ensure validation is performed before saving.
        """
        self.full_clean()
        super().save(*args, **kwargs)

class ItemList(TimeStampedModel):
    """
    User-defined lists for organizing inventory items.

    This model allows users to create custom collections of items for:
    - Project-specific inventories
    - Temporary groupings (e.g., "Items for Audit")
    - Categorization beyond tags and locations
    - Export and reporting purposes

    Features:
    - User-scoped for privacy
    - Many-to-many relationship with items
    - Items can belong to multiple lists
    - Lists can be empty
    """

    # List name with reasonable length limit
    name = models.CharField(max_length=255)

    # User who owns this list
    # CASCADE deletion ensures data consistency
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,                   # Use configured user model
        on_delete=models.CASCADE,                   # Delete lists when user is deleted
        related_name='item_lists',                   # Access user's lists via user.item_lists.all()
    )

    # Many-to-many relationship with items
    # Items can be in multiple lists, lists can contain multiple items
    items = models.ManyToManyField('Item', related_name='lists', blank=True)

    class Meta:
        # Ensure each user cannot have duplicate list names
        unique_together = ('owner', 'name')

        # Default ordering - sort lists alphabetically by name
        ordering = ['name']

        # German verbose names for Django admin
        verbose_name = 'Inventarliste'             # German: "Inventory List"
        verbose_name_plural = 'Inventarlisten'     # German: "Inventory Lists"

    def __str__(self) -> str:
        """String representation of the list."""
        return self.name


class DuplicateQuarantine(TimeStampedModel):
    """Stores user-marked false-positive duplicate pairs."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='duplicate_quarantines',
    )

    item_a = models.ForeignKey(
        'Item',
        on_delete=models.CASCADE,
        related_name='duplicate_quarantined_primary',
    )

    item_b = models.ForeignKey(
        'Item',
        on_delete=models.CASCADE,
        related_name='duplicate_quarantined_secondary',
    )

    reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'item_a', 'item_b'],
                condition=Q(is_active=True),
                name='unique_active_duplicate_quarantine_pair',
            )
        ]

    def clean(self):
        super().clean()
        if self.item_a_id == self.item_b_id:
            raise ValidationError('Item-Paare müssen unterschiedlich sein.')
        if self.item_a.owner_id != self.owner_id or self.item_b.owner_id != self.owner_id:
            raise ValidationError('Quarantäne-Paare müssen zu deinem Konto gehören.')

    def save(self, *args, **kwargs):
        if self.item_a_id and self.item_b_id and self.item_a_id > self.item_b_id:
            self.item_a, self.item_b = self.item_b, self.item_a
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Quarantine #{self.pk}: {self.item_a_id}-{self.item_b_id}"
