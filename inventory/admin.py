from django.contrib import admin
from .models import Item, ItemImage, ItemList, Location, Tag

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = 'name', 'user', 'created_at', 'updated_at'
    search_fields = 'name', 'user__email'
    list_filter = 'user',
    ordering = 'name',

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = 'name', 'user', 'created_at', 'updated_at'
    search_fields = 'name', 'user__email'
    list_filter = 'user',
    ordering = 'name',

class ItemImageInline(admin.TabularInline):
    model = ItemImage
    extra = 1

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'location', 'wodis_inventory_number',
        'quantity', 'purchase_date', 'value', 'created_at', 'updated_at')
    search_fields = ('name', 'description', 'wodis_inventory_number',
        'owner__email', 'tags__name')
    list_filter = 'owner', 'location', 'tags'
    inlines = [ItemImageInline]
    filter_horizontal = 'tags',

@admin.register(ItemList)
class ItemListAdmin(admin.ModelAdmin):
    list_display = 'name', 'owner', 'created_at', 'updated_at'
    search_fields = 'name', 'owner__email'
    list_filter = 'owner',
    filter_horizontal = 'items',

@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    list_display = 'item', 'image', 'created_at', 'updated_at'
    search_fields = 'item__name',
