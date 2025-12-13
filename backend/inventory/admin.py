# Django Admin Configuration for Inventory Models
# ===============================================
# This module configures the Django admin interface for all inventory-related models.
# It provides a powerful web-based interface for administrators to manage:
# - Tags, Locations, Items, Item Images, and Item Lists
# - Bulk operations, filtering, searching, and custom displays
# - Inline editing capabilities for related objects

from django.contrib import admin        # Django admin framework
from .models import Item, ItemImage, ItemList, Location, Tag  # Import all models

# =========================
# TAG ADMIN CONFIGURATION
# =========================

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """
    Admin interface configuration for Tag model.

    Provides administrators with tools to manage user-created tags including:
    - Viewing tag name, owner, and timestamps in list view
    - Searching by tag name or user email
    - Filtering by user to see all tags for a specific user
    - Alphabetical ordering by tag name
    """
    # Columns to display in the admin list view
    list_display = 'name', 'user', 'created_at', 'updated_at'

    # Fields that can be searched in the search box
    # Supports searching by tag name and the owning user's email
    search_fields = 'name', 'user__email'

    # Sidebar filters available for narrowing down results
    # Allows filtering tags by user to see all tags for a specific user
    list_filter = 'user',

    # Default ordering for the list view (alphabetically by name)
    ordering = 'name',

# =========================
# LOCATION ADMIN CONFIGURATION
# =========================

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    """
    Admin interface configuration for Location model.

    Provides administrators with tools to manage physical locations including:
    - Viewing location name, owner, and timestamps in list view
    - Searching by location name or user email
    - Filtering by user to see all locations for a specific user
    - Alphabetical ordering by location name
    """
    # Columns to display in the admin list view
    list_display = 'name', 'user', 'created_at', 'updated_at'

    # Fields that can be searched in the search box
    # Supports searching by location name and the owning user's email
    search_fields = 'name', 'user__email'

    # Sidebar filters available for narrowing down results
    # Allows filtering locations by user
    list_filter = 'user',

    # Default ordering for the list view (alphabetically by name)
    ordering = 'name',

# =========================
# ITEM IMAGE INLINE ADMIN
# =========================

class ItemImageInline(admin.TabularInline):
    """
    Inline admin interface for ItemImage model.

    This allows images to be edited directly on the Item admin page
    in a tabular format (compact, table-like display). Features:
    - Add/edit/delete images without leaving the item page
    - Shows one extra empty form by default for adding new images
    - Tabular display is more compact than stacked display
    """
    # The model to use for the inline
    model = ItemImage

    # Number of extra empty forms to display (for adding new images)
    extra = 1

# =========================
# ITEM ADMIN CONFIGURATION
# =========================

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """
    Admin interface configuration for Item model.

    The most comprehensive admin interface, providing full management of inventory items:
    - Comprehensive list view with all key fields
    - Multi-field search across name, description, inventory numbers, owner, and tags
    - Filtering by owner, location, and tags
    - Inline image management (add/edit/delete images on item page)
    - Horizontal filter widget for managing many-to-many tag relationships

    This is the central admin interface for inventory management.
    """
    # Columns to display in the admin list view
    # Shows all important item information at a glance
    list_display = ('name', 'owner', 'location', 'wodis_inventory_number',
        'quantity', 'purchase_date', 'value', 'created_at', 'updated_at')

    # Fields that can be searched in the search box
    # Comprehensive search across multiple fields including related objects
    # Note: tags__name allows searching by tag name (across many-to-many relationship)
    search_fields = ('name', 'description', 'wodis_inventory_number',
        'owner__email', 'tags__name')

    # Sidebar filters available for narrowing down results
    # Allows filtering by owner (user), location, and tags
    list_filter = 'owner', 'location', 'tags'

    # Inline forms to display on the item detail page
    # Allows managing item images directly on the item page
    inlines = [ItemImageInline]

    # Use horizontal filter widget for many-to-many relationships
    # Provides a better UI for selecting multiple tags (two side-by-side boxes)
    filter_horizontal = 'tags',

# =========================
# ITEM LIST ADMIN CONFIGURATION
# =========================

@admin.register(ItemList)
class ItemListAdmin(admin.ModelAdmin):
    """
    Admin interface configuration for ItemList model.

    Provides administrators with tools to manage user-created inventory lists:
    - Viewing list name, owner, and timestamps
    - Searching by list name or owner email
    - Filtering by owner to see all lists for a specific user
    - Horizontal filter widget for managing list items (many-to-many relationship)

    Lists allow users to organize items into custom collections.
    """
    # Columns to display in the admin list view
    list_display = 'name', 'owner', 'created_at', 'updated_at'

    # Fields that can be searched in the search box
    # Supports searching by list name and the owning user's email
    search_fields = 'name', 'owner__email'

    # Sidebar filters available for narrowing down results
    # Allows filtering lists by owner
    list_filter = 'owner',

    # Use horizontal filter widget for many-to-many relationships
    # Provides a better UI for selecting multiple items for the list
    filter_horizontal = 'items',

# =========================
# ITEM IMAGE ADMIN CONFIGURATION
# =========================

@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    """
    Admin interface configuration for ItemImage model.

    Provides administrators with tools to manage item images/attachments:
    - Viewing associated item, image file path, and timestamps
    - Searching by item name to find images for specific items
    - Simple list view for quick overview of all uploaded files

    Note: Images can also be managed inline on the Item admin page.
    This standalone admin is useful for bulk image management.
    """
    # Columns to display in the admin list view
    # Shows which item the image belongs to, the file path, and timestamps
    list_display = 'item', 'image', 'created_at', 'updated_at'

    # Fields that can be searched in the search box
    # Supports searching by the associated item's name
    # Note: item__name searches across the foreign key relationship
    search_fields = 'item__name',
