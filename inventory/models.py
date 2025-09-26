import uuid

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Tag(TimeStampedModel):
    name = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tags',
    )

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['name']
        verbose_name = 'Schlagwort'
        verbose_name_plural = 'Schlagwörter'

    def __str__(self) -> str:
        return self.name


class Location(TimeStampedModel):
    name = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='locations',
    )

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['name']
        verbose_name = 'Standort'
        verbose_name_plural = 'Standorte'

    def __str__(self) -> str:
        return self.name


class Item(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    purchase_date = models.DateField(blank=True, null=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    asset_tag = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
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
    tags = models.ManyToManyField('Tag', related_name='items', blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Gegenstand'
        verbose_name_plural = 'Gegenstände'

    def __str__(self) -> str:
        return self.name


class ItemImage(TimeStampedModel):
    item = models.ForeignKey('Item', on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='item_images/')

    class Meta:
        verbose_name = 'Gegenstandsbild'
        verbose_name_plural = 'Gegenstandsbilder'

    def __str__(self) -> str:
        return f"Bild für {self.item.name}"


class ItemChangeLog(TimeStampedModel):
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'

    ACTION_CHOICES = (
        (ACTION_CREATE, 'Erstellung'),
        (ACTION_UPDATE, 'Aktualisierung'),
        (ACTION_DELETE, 'Löschung'),
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
        ordering = ['-created_at']
        verbose_name = 'Änderungsprotokoll'
        verbose_name_plural = 'Änderungsprotokolle'

    def __str__(self) -> str:
        target = self.item.name if self.item else self.item_name or 'Unbekanntes Objekt'
        return f"{self.get_action_display()} für {target}"


class ItemList(TimeStampedModel):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='item_lists',
    )
    items = models.ManyToManyField('Item', related_name='lists', blank=True)

    class Meta:
        unique_together = ('owner', 'name')
        ordering = ['name']
        verbose_name = 'Inventarliste'
        verbose_name_plural = 'Inventarlisten'

    def __str__(self) -> str:
        return self.name
