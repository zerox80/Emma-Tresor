from django.contrib import admin

from .models import Item, ItemImage, ItemList, Location, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Tag model.
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Location model.
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


class ItemImageInline(admin.TabularInline):
    """
    Inline admin configuration for ItemImage model.
    """
    model = ItemImage
    extra = 1


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Item model.
    """
    list_display = (
        'name',
        'owner',
        'location',
        'wodis_inventory_number',
        'quantity',
        'purchase_date',
        'value',
        'created_at',
        'updated_at',
    )
    search_fields = ('name', 'description', 'wodis_inventory_number', 'owner__email', 'tags__name')
    list_filter = ('owner', 'location', 'tags')
    inlines = [ItemImageInline]
    filter_horizontal = ('tags',)


@admin.register(ItemList)
class ItemListAdmin(admin.ModelAdmin):
    """
    Admin configuration for the ItemList model.
    """
    list_display = ('name', 'owner', 'created_at', 'updated_at')
    search_fields = ('name', 'owner__email')
    list_filter = ('owner',)
    filter_horizontal = ('items',)


@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    """
    Admin configuration for the ItemImage model.
    """
    list_display = ('item', 'image', 'created_at', 'updated_at')
    search_fields = ('item__name',)
