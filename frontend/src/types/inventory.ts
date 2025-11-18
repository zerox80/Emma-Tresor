// Inventory Management Type Definitions
// ===================================
// This module contains TypeScript interfaces for inventory-related data structures
// including items, images, tags, locations, and API response formats.

// =================
// Image Management
// =================

/**
 * Interface for item image metadata.
 *
 * Represents uploaded images associated with inventory items,
 * including URLs for different display sizes and file information.
 */
export interface ItemImage {
  /** Unique database identifier for the image */
  id: number;

  /** URL for displaying preview-sized version of the image */
  preview_url: string;

  /** URL for downloading the full-size original image */
  download_url: string;

  /** Original filename of the uploaded image */
  filename: string;

  /** MIME content type of the image (e.g., 'image/jpeg', 'image/png') */
  content_type: string;

  /** Backend API endpoint for the image resource */
  image: string;
}

// =====================
// Duplicate Finder Types
// =====================

export interface DuplicateItemPreview {
  id: number;
  name: string;
  description: string | null;
  quantity: number;
  purchase_date: string | null;
  value: string | null;
  location: number | null;
  wodis_inventory_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateGroup {
  group_id: number;
  match_reasons: string[];
  items: DuplicateItemPreview[];
}

export interface DuplicateFinderResponse {
  count: number;
  analyzed_count: number;
  limit: number;
  preset_used: string | null;
  results: DuplicateGroup[];
}

export interface DuplicateQuarantineEntry {
  id: number;
  item_a: DuplicateItemPreview;
  item_b: DuplicateItemPreview;
  reason: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

// ============
// Item Data
// ============

/**
 * Interface for a complete inventory item.
 *
 * Represents an item with all its properties as returned from the API.
 * Includes references to related entities through IDs and embedded data.
 */
export interface Item {
  /** Unique database identifier for the item */
  id: number;

  /** Display name of the item */
  name: string;

  /** Detailed description of the item (optional) */
  description: string | null;

  /** Current quantity/stock count of the item */
  quantity: number;

  /** Date when the item was purchased (ISO string format) */
  purchase_date: string | null;

  /** Monetary value of the item as string (supports decimal values) */
  value: string | null;

  /** Unique asset tag for tracking and QR code generation */
  asset_tag: string;

  /** Location ID where the item is stored (foreign key) */
  location: number | null;

  /** Array of tag IDs associated with the item */
  tags: number[];

  /** Array of uploaded images associated with the item */
  images: ItemImage[];

  /** WODIS system inventory number (optional external reference) */
  wodis_inventory_number: string | null;
}

/**
 * Interface for item data used in API requests.
 *
 * Represents the payload structure when creating or updating items.
 * Excludes read-only fields like id and computed values.
 */
export interface ItemPayload {
  /** Display name of the item (required) */
  name: string;

  /** Detailed description of the item (optional) */
  description: string | null;

  /** Current quantity/stock count of the item (required) */
  quantity: number;

  /** Date when the item was purchased (optional) */
  purchase_date: string | null;

  /** Monetary value of the item as string (optional) */
  value: string | null;

  /** Location ID where the item is stored (optional) */
  location: number | null;

  /** Array of tag IDs to associate with the item */
  tags: number[];

  /** WODIS system inventory number (optional external reference) */
  wodis_inventory_number: string | null;
}

// ==================
// Tags & Locations
// ==================

/**
 * Interface for a tag used to categorize items.
 *
 * Tags are simple label entities that can be associated
 * with multiple items for organization and filtering.
 */
export interface Tag {
  /** Unique database identifier for the tag */
  id: number;

  /** Display name of the tag */
  name: string;
}

/**
 * Interface for a storage location.
 *
 * Locations represent physical or logical places where
 * inventory items are stored or located.
 */
export interface Location {
  /** Unique database identifier for the location */
  id: number;

  /** Display name of the location */
  name: string;
}

// =============
// Lists Management
// =============

/**
 * Interface for custom item lists.
 *
 * Lists allow users to organize items into custom collections
 * for specific purposes (e.g., "Items to Move", "Audit List").
 */
export interface ItemList {
  /** Unique database identifier for the list */
  id: number;

  /** Display name of the list */
  name: string;

  /** Array of item IDs included in this list */
  items: number[];
}

// ================
// Change Tracking
// ================

/**
 * Interface for item change log entries.
 *
 * Records the history of modifications made to items,
 * providing audit trail and change tracking capabilities.
 */
export interface ItemChangeLog {
  /** Unique database identifier for the change log entry */
  id: number;

  /** Timestamp when the change was made (ISO string format) */
  created_at: string;

  /** Machine-readable action identifier (e.g., 'update', 'create', 'delete') */
  action: string;

  /** Human-readable display name for the action */
  action_display: string;

  /** Username of the user who made the change (null for system actions) */
  user_username: string | null;

  /** Detailed record of what fields were changed and their new/old values */
  changes: Record<string, any>;
}

// ==================
// API Response Types
// ==================

/**
 * Interface for paginated API responses.
 *
 * Standard Django REST Framework pagination format
 * used for list endpoints that support pagination.
 *
 * @template T - The type of items in the results array
 */
export interface PaginatedResponse<T> {
  /** Total number of items available across all pages */
  count: number;

  /** URL for the next page of results (null if last page) */
  next: string | null;

  /** URL for the previous page of results (null if first page) */
  previous: string | null;

  /** Array of items for the current page */
  results: T[];
}

// ==================
// API Parameter Types
// ==================

/**
 * Interface for parameters used in item fetching requests.
 *
 * Defines the available filters, pagination options,
 * and sorting parameters for the items API endpoint.
 *
 * @deprecated Use FetchItemsOptions from inventory API instead
 */
export interface FetchItemsParams {
  /** Search query to filter items by name, description, or asset tag */
  query?: string;

  /** Page number for pagination (1-based) */
  page?: number;

  /** Number of items per page for pagination */
  pageSize?: number;

  /** Array of tag IDs to filter items by */
  tags?: number[];

  /** Array of location IDs to filter items by */
  locations?: number[];

  /** Ordering string for sorting results (e.g., 'name', '-created_at') */
  ordering?: string;
}

/**
 * Interface for parameters used in item export requests.
 *
 * Similar to FetchItemsParams but excludes pagination since
 * exports return all matching items in a single file.
 *
 * @deprecated Use ExportItemsOptions from inventory API instead
 */
export interface ExportItemsParams {
  /** Search query to filter exported items */
  query?: string;

  /** Array of tag IDs to filter exported items by */
  tags?: number[];

  /** Array of location IDs to filter exported items by */
  locations?: number[];

  /** Ordering string for sorting exported items */
  ordering?: string;
}

/**
 * Interface for options when fetching QR codes.
 *
 * Controls the behavior of QR code generation and download.
 *
 * @deprecated Use FetchItemQrCodeOptions from inventory API instead
 */
export interface FetchQrCodeOptions {
  /** Whether to trigger download of the QR code image file */
  download?: boolean;
}
