from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models, IntegrityError
from datetime import date, timedelta
from PIL import Image, UnidentifiedImageError
import os
import uuid

try:
    from .storage import private_item_storage
except ImportError as exc:
    raise ImportError('Private storage backend not available') from exc


class TimeStampedModel(models.Model):
    """An abstract base class model that provides self-updating
    `created_at` and `updated_at` fields.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta configuration for the abstract timestamped base model."""
        abstract = True


class Tag(TimeStampedModel):
    """Represents a tag that can be associated with an item.

    Attributes:
        name: The name of the tag.
        user: The user who created the tag.
    """
    name = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tags',
    )

    class Meta:
        """Meta options that scope tags per user and order alphabetically."""
        unique_together = ('user', 'name')
        ordering = ['name']
        verbose_name = 'Schlagwort'
        verbose_name_plural = 'Schlagwörter'

    def __str__(self) -> str:
        """Returns the string representation of the tag."""
        return self.name


class Location(TimeStampedModel):
    """Represents a location where an item can be stored.

    Attributes:
        name: The name of the location.
        user: The user who created the location.
    """
    name = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='locations',
    )

    class Meta:
        """Meta options that ensure location names are unique per user."""
        unique_together = ('user', 'name')
        ordering = ['name']
        verbose_name = 'Standort'
        verbose_name_plural = 'Standorte'

    def __str__(self) -> str:
        """Returns the string representation of the location."""
        return self.name


MAX_PURCHASE_AGE_YEARS = 50


class Item(TimeStampedModel):
    """Represents an item in the inventory.

    Attributes:
        name: The name of the item.
        description: A description of the item.
        quantity: The quantity of the item.
        purchase_date: The date the item was purchased.
        value: The value of the item.
        asset_tag: A unique identifier for the item.
        owner: The user who owns the item.
        location: The location where the item is stored.
        wodis_inventory_number: An optional inventory number from an external
            system.
        tags: The tags associated with the item.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(
        default=1, 
        validators=[MinValueValidator(1), MaxValueValidator(999999)]
    )
    purchase_date = models.DateField(blank=True, null=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    asset_tag = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='items',
    )
    location = models.ForeignKey(
        'Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
    )
    wodis_inventory_number = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        db_index=True,
        help_text='Optionale Inventarnummer aus Wodis',
    )
    tags = models.ManyToManyField('Tag', related_name='items', blank=True)

    class Meta:
        """Meta configuration for items, including ordering and indexes."""
        ordering = ['name']
        verbose_name = 'Gegenstand'
        verbose_name_plural = 'Gegenstände'
        indexes = [
            models.Index(fields=['wodis_inventory_number']),
        ]

    def clean(self):
        """
        Validates the item's data.

        Raises:
            ValidationError: If the purchase date is in the future or too old,
                or if the value is negative or too high.
        """
        super().clean()
        # Validate purchase date
        if self.purchase_date:
            if self.purchase_date > date.today():
                raise ValidationError({'purchase_date': 'Das Kaufdatum darf nicht in der Zukunft liegen.'})
            
            min_date = date.today() - timedelta(days=365 * MAX_PURCHASE_AGE_YEARS)
            if self.purchase_date < min_date:
                raise ValidationError({'purchase_date': f'Das Kaufdatum ist zu alt. Maximal {MAX_PURCHASE_AGE_YEARS} Jahre zurück.'})
        
        # Validate value
        if self.value is not None:
            if self.value < 0:
                raise ValidationError({'value': 'Der Wert darf nicht negativ sein.'})
            if self.value > 999999999.99:
                raise ValidationError({'value': 'Der Wert ist zu hoch. Maximal 999.999.999,99 € erlaubt.'})

        if self.wodis_inventory_number is not None:
            cleaned = str(self.wodis_inventory_number).strip()
            self.wodis_inventory_number = cleaned or None

    def save(self, *args, **kwargs):
        """
        Saves the item, ensuring a unique asset tag is generated.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        max_attempts = kwargs.pop('max_uuid_attempts', 5)
        attempt = 0
        while True:
            self.full_clean()
            try:
                super().save(*args, **kwargs)
                return
            except IntegrityError as exc:
                if 'asset_tag' not in str(exc).lower():
                    raise
                attempt += 1
                if attempt >= max_attempts:
                    raise
                self.asset_tag = uuid.uuid4()

    def __str__(self) -> str:
        """Returns the string representation of the item."""
        return self.name


class ItemImage(TimeStampedModel):
    """Represents an image associated with an item.

    Attributes:
        item: The item the image is associated with.
        image: The image file.
    """
    item = models.ForeignKey('Item', on_delete=models.CASCADE, related_name='images')
    image = models.FileField(upload_to='item_attachments/', storage=private_item_storage)

    class Meta:
        """Meta configuration for stored item images."""
        verbose_name = 'Gegenstandsbild'
        verbose_name_plural = 'Gegenstandsbilder'

    def __str__(self) -> str:
        """Returns a string representation of the item image."""
        return f"Bild für {self.item.name}"

    def clean(self):
        """
        Validates the uploaded image file.

        Raises:
            ValidationError: If the file is too large, has an invalid extension,
                or is not a valid image or PDF file.
        """
        super().clean()
        if self.image:
            # Check file size (8MB max)
            max_size = 8 * 1024 * 1024  # 8MB in bytes
            if self.image.size > max_size:
                raise ValidationError('Die Datei ist zu groß. Maximal 8 MB erlaubt.')

            allowed_extensions = {
                '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic', '.heif', '.pdf'
            }
            ext = os.path.splitext(self.image.name)[1].lower()
            if ext not in allowed_extensions:
                raise ValidationError('Ungültige Dateierweiterung. Erlaubt sind Bild- oder PDF-Dateien.')

            file_obj = self.image.file
            pos = file_obj.tell()
            try:
                file_obj.seek(0)
                header = file_obj.read(4)
                file_obj.seek(0)

                if ext == '.pdf':
                    if header != b'%PDF':
                        raise ValidationError('Die Datei ist kein gültiges PDF-Dokument.')
                else:
                    try:
                        # Step 1: Basic header validation
                        with Image.open(file_obj) as img:
                            img.verify()
                        
                        # Step 2: Reset file pointer (verify() consumes the stream)
                        file_obj.seek(0)
                        
                        # Step 3: CRITICAL SECURITY FIX - Load and validate all pixel data
                        # This protects against:
                        # - Decompression bombs (malformed compressed data)
                        # - Corrupted/malicious pixel payloads
                        # - CVEs in image decoding libraries
                        with Image.open(file_obj) as img:
                            img.load()  # Decodes all pixel data - will raise exception if corrupted
                            
                            # Additional protection: Prevent decompression bombs
                            MAX_PIXELS = 89478485  # PIL's MAX_IMAGE_PIXELS default (~8K x 8K)
                            if img.width * img.height > MAX_PIXELS:
                                raise ValidationError(
                                    f'Bild ist zu groß: {img.width}x{img.height} Pixel. '
                                    f'Maximum: {MAX_PIXELS} Pixel gesamt (ca. 9500x9500).'
                                )
                    except (UnidentifiedImageError, OSError) as exc:
                        raise ValidationError('Die Datei ist kein gültiges Bild.') from exc
                    finally:
                        file_obj.seek(0)
            finally:
                file_obj.seek(pos)

    def save(self, *args, **kwargs):
        """
        Saves the item image after validation.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        self.full_clean()  # Ensure validation runs
        super().save(*args, **kwargs)


class ItemChangeLog(TimeStampedModel):
    """Represents a log of changes made to an item.

    Attributes:
        item: The item that was changed.
        item_name: The name of the item at the time of the change.
        user: The user who made the change.
        action: The action that was performed (create, update, or delete).
        changes: A JSON object describing the changes made.
    """
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'

    ACTION_CHOICES = (
        ('create', 'Erstellung'),
        ('update', 'Aktualisierung'),
        ('delete', 'Löschung'),
    )

    item = models.ForeignKey('Item', on_delete=models.SET_NULL, related_name='change_logs', null=True, blank=True)
    item_name = models.CharField(max_length=255, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='item_change_logs',
    )
    action = models.CharField(max_length=12, choices=ACTION_CHOICES)
    changes = models.JSONField(blank=True, default=dict)

    class Meta:
        """Meta settings for change log entries sorted by recency."""
        ordering = ['-created_at']
        verbose_name = 'Änderungsprotokoll'
        verbose_name_plural = 'Änderungsprotokolle'
        indexes = [
            models.Index(fields=['item', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def clean(self):
        """
        Validates the change log's data.

        Raises:
            ValidationError: If the action is not a valid choice.
        """
        super().clean()
        valid_actions = [choice[0] for choice in self.ACTION_CHOICES]
        if self.action not in valid_actions:
            raise ValidationError(f'Ungültige Aktion: {self.action}. Erlaubt sind: {", ".join(valid_actions)}')

    def save(self, *args, **kwargs):
        """
        Saves the change log after validation.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        self.full_clean()
        super().save(*args, **kwargs)


class ItemList(TimeStampedModel):
    """Represents a list of items.

    Attributes:
        name: The name of the list.
        owner: The user who owns the list.
        items: The items in the list.
    """
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='item_lists',
    )
    items = models.ManyToManyField('Item', related_name='lists', blank=True)

    class Meta:
        """Meta configuration for user-defined item lists."""
        unique_together = ('owner', 'name')
        ordering = ['name']
        verbose_name = 'Inventarliste'
        verbose_name_plural = 'Inventarlisten'

    def __str__(self) -> str:
        """Returns the string representation of the item list."""
        return self.name
