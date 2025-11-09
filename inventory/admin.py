from django.contrib import admin

from .models import Item, ItemImage, ItemList, Location, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin configuration for Tag model.

    Provides admin interface for managing tags with display of name,
    associated user, and timestamps. Includes search functionality
    by tag name and user email, and filtering by user.
    
    Features:
    - Displays tag name, owner email, creation and update timestamps
    - Search by tag name and owner email for quick lookups
    - Filter by user to see only tags owned by current admin user
    - Ordering by name for organized tag management
    
    Attributes:
        list_display: Tuple of field names to display in list view
        - name: Tag name for identification
        - user: Owner email for ownership tracking
        - created_at: Creation timestamp for auditing
        - updated_at: Last modification timestamp
        search_fields: Fields to search in admin interface
            - name: Primary search field for tag names
            - user__email: Secondary search for owner identification
        list_filter: Fields to filter by in admin interface
            - user: Filter tags by specific user
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)
    ordering = ('name',)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    """Admin configuration for Location model.

    Provides admin interface for managing storage locations with display
    of name, associated user, and timestamps. Includes search functionality
    by location name and user email, and filtering by user.
    
    Features:
    - Displays location name, owner email, creation and update timestamps
    - Search by location name and owner email for quick lookups
    - Filter by user to see only locations owned by current admin user
    - Ordering by name for organized location management
    
    Attributes:
        list_display: Tuple of field names to display in list view
        - name: Location name for identification
        - user: Owner email for ownership tracking
        - created_at: Creation timestamp for auditing
        - updated_at: Last modification timestamp
        search_fields: Fields to search in admin interface
            - name: Primary search field for location names
            - user__email: Secondary search for owner identification
        list_filter: Fields to filter by in admin interface
            - user: Filter locations by specific user
    """
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)
    ordering = ('name',)


class ItemImageInline(admin.TabularInline):
    """Inline admin configuration for ItemImage model.

    Allows editing item images directly within the Item admin interface.
    Displays one empty form by default for adding new images.
    
    Features:
    - Inline editing: Edit images within item detail page
    - Extra forms: One empty form by default for adding new images
    - Efficient management: Reduces page clicks by enabling inline operations
    
    Configuration:
        model: ItemImage model this inline manages
        extra: Number of empty forms to display (1 for new image)
    """
    model = ItemImage
    extra = 1


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """Admin configuration for Item model.

    Provides comprehensive admin interface for managing inventory items
    with display of key attributes, search functionality across multiple
    fields, filtering options, and inline image editing.
    
    Features:
    - Comprehensive display: Shows all relevant item fields at a glance
    - Advanced search: Search across name, description, inventory numbers, and tags
    - Smart filtering: Filter by owner, location, and tags for better organization
    - Inline images: Edit item images without leaving the item page
    - Horizontal tag filtering: Easy tag selection interface
    
    Attributes:
        list_display: Key item fields for list view
            - name: Item identifier
            - owner: Owner for permission tracking
            - location: Storage location for inventory management
            - wodis_inventory_number: External system reference
            - quantity: Stock count
            - purchase_date: Acquisition tracking
            - value: Monetary valuation
            - created_at/updated_at: Audit timestamps
        search_fields: Multi-field search capabilities
            - name: Primary search by item name
            - description: Full-text search in item details
            - wodis_inventory_number: Search by external inventory number
            - owner__email: Filter by owner email
            - tags__name: Search by associated tag names
        list_filter: Organization and filtering options
            - owner: Filter by specific user
            - location: Filter by storage location
            - tags: Filter by associated tags
        inlines: Related model editing
            - ItemImageInline: Edit images inline
        filter_horizontal: UI enhancement for many-to-many relationships
            - tags: Horizontal filter for better tag management
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
    """Admin configuration for ItemList model.

    Provides admin interface for managing user-defined item lists with
    display of name, owner, and timestamps. Includes search functionality
    by list name and user email, filtering by user, and horizontal filter
    for managing item associations.
    
    Features:
    - List management: Create and organize custom item collections
    - Ownership tracking: Clear display of list ownership
    - Search capabilities: Find lists by name or owner
    - User filtering: Admins only see their own lists
    - Item association: Horizontal filter for easy item management
    
    Attributes:
        list_display: Core list fields for identification
            - name: List name for user reference
            - owner: Owner for permission tracking
            - created_at/updated_at: Audit timestamps
        search_fields: Search functionality for list discovery
            - name: Primary search by list name
            - owner__email: Filter by owner email
        list_filter: Ownership-based filtering
            - owner: Restrict to current user's lists
        filter_horizontal: Enhanced UI for many-to-many relationships
            - items: Horizontal filter for item-list associations
    """
    list_display = ('name', 'owner', 'created_at', 'updated_at')
    search_fields = ('name', 'owner__email')
    list_filter = ('owner',)
    filter_horizontal = ('items',)


@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    """Admin configuration for ItemImage model.

    Provides admin interface for managing item images with display of
    associated item, image file, and timestamps. Includes search
    functionality by item name.
    
    Features:
    - Image management: Central interface for all item images
    - Item association: Clear display of which item each image belongs to
    - File tracking: Display image file names and metadata
    - Search capability: Find images by associated item name
    - Timestamp tracking: Monitor image upload and modification times
    
    Attributes:
        list_display: Image identification and association
            - item: Parent item this image belongs to
            - image: File name and preview
            - created_at/updated_at: Upload and modification tracking
        search_fields: Find images by parent item
            - item__name: Search by associated item name
    """
    list_display = ('item', 'image', 'created_at', 'updated_at')
    search_fields = ('item__name',)
