from django.contrib import admin

from .models import Item, ItemImage, ItemList, Location, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin configuration for the Tag model.

    Provides admin interface for managing tags with display of name,
    associated user, and timestamps. Includes search functionality
    by tag name and user email, and filtering by user.
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    """Admin configuration for the Location model.

    Provides admin interface for managing storage locations with display
    of name, associated user, and timestamps. Includes search functionality
    by location name and user email, and filtering by user.
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


class ItemImageInline(admin.TabularInline):
    """Inline admin configuration for ItemImage model.

    Allows editing item images directly within the Item admin interface.
    Displays one empty form by default for adding new images.
    """
    model = ItemImage
    extra = 1


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """Admin configuration for the Item model.

    Provides comprehensive admin interface for managing inventory items
    with display of key attributes, search functionality across multiple
    fields, filtering options, and inline image editing.
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
    """Admin configuration for the ItemList model.

    Provides admin interface for managing user-defined item lists with
    display of name, owner, and timestamps. Includes search functionality
    by list name and user email, filtering by user, and horizontal filter
    for managing item associations.
    """
    list_display = ('name', 'owner', 'created_at', 'updated_at')
    search_fields = ('name', 'owner__email')
    list_filter = ('owner',)
    filter_horizontal = ('items',)


@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    """Admin configuration for the ItemImage model.

    Provides admin interface for managing item images with display of
    associated item, image file, and timestamps. Includes search
    functionality by item name.
    """
    list_display = ('item', 'image', 'created_at', 'updated_at')
    search_fields = ('item__name',)
