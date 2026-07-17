"""Audit, media, list, and duplicate-quarantine inventory models."""

from datetime import date, timedelta
import os

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import IntegrityError, models, transaction
from django.db.models import Q
from PIL import Image, UnidentifiedImageError

from .models_core import Item, TimeStampedModel
from .storage import private_item_storage

Image.MAX_IMAGE_PIXELS = 16777216
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
                            raise ValidationError(
                                'Bildverarbeitung fehlgeschlagen. Bitte verwende ein anderes Bild.'
                            ) from processing_error

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
        # Keep attachment persistence and its audit event indivisible.
        with transaction.atomic():
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
