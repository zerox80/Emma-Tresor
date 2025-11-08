/**
 * Represents an image or file attachment associated with an inventory item.
 */
export interface ItemImage {
  /** The unique identifier for the image. */
  id: number;
  /** The URL for a preview of the image. */
  preview_url: string;
  /** The URL for downloading the full-resolution image. */
  download_url: string;
  /** The original filename of the image. */
  filename: string;
  /** The MIME type of the image (e.g., 'image/jpeg', 'application/pdf'). */
  content_type: string;
  /** The URL of the image itself (might be the same as preview_url or download_url depending on context). */
  image: string;
}

/**
 * Represents a single inventory item.
 */
export interface Item {
  /** The unique identifier for the item. */
  id: number;
  /** The name of the item. */
  name: string;
  /** A detailed description of the item. */
  description: string | null;
  /** The quantity of the item available. */
  quantity: number;
  /** The purchase date of the item in ISO format (e.g., 'YYYY-MM-DD'). */
  purchase_date: string | null;
  /** The estimated monetary value of the item. */
  value: string | null;
  /** The unique asset tag associated with the item, often used for QR codes. */
  asset_tag: string;
  /** The ID of the location where the item is stored. */
  location: number | null;
  /** An array of IDs of tags associated with the item. */
  tags: number[];
  /** An array of image attachments for the item. */
  images: ItemImage[];
  /** The WODIS inventory number, if applicable. */
  wodis_inventory_number: string | null;
}

/**
 * Represents the payload structure for creating or updating an inventory item.
 */
export interface ItemPayload {
  /** The name of the item. */
  name: string;
  /** A detailed description of the item. */
  description: string | null;
  /** The quantity of the item. */
  quantity: number;
  /** The purchase date of the item in ISO format (e.g., 'YYYY-MM-DD'). */
  purchase_date: string | null;
  /** The estimated monetary value of the item. */
  value: string | null;
  /** The ID of the location where the item is stored. */
  location: number | null;
  /** An array of IDs of tags associated with the item. */
  tags: number[];
  /** The WODIS inventory number, if applicable. */
  wodis_inventory_number: string | null;
}

/**
 * Represents a tag that can be applied to inventory items. */
export interface Tag {
  /** The unique identifier for the tag. */
  id: number;
  /** The name of the tag. */
  name: string;
}

/**
 * Represents a physical location where inventory items can be stored.
 */
export interface Location {
  /** The unique identifier for the location. */
  id: number;
  /** The name of the location. */
  name: string;
}

/**
 * Represents a curated list of inventory items.
 */
export interface ItemList {
  /** The unique identifier for the list. */
  id: number;
  /** The name of the list. */
  name: string;
  /** An array of IDs of items included in this list. */
  items: number[];
}

/**
 * Represents a single entry in an item's change log.
 */
export interface ItemChangeLog {
  /** The unique identifier for the log entry. */
  id: number;
  /** The timestamp when the change occurred. */
  created_at: string;
  /** The type of action performed (e.g., 'create', 'update', 'delete'). */
  action: string;
  /** A human-readable display name for the action. */
  action_display: string;
  /** The username of the user who performed the action. */
  user_username: string | null;
  /** A JSON object detailing the changes made (e.g., old and new values for fields). */
  changes: Record<string, any>;
}

/**
 * Represents a paginated response structure from the API.
 * @template T The type of the items in the results array.
 */
export interface PaginatedResponse<T> {
  /** The total number of items across all pages. */
  count: number;
  /** The URL for the next page of results, or null if there is no next page. */
  next: string | null;
  /** The URL for the previous page of results, or null if there is no previous page. */
  previous: string | null;
  /** An array of items for the current page. */
  results: T[];
}

/**
 * Represents parameters for fetching a list of items from the API.
 */
export interface FetchItemsParams {
  /** A search query string to filter items by name, description, or asset tag. */
  query?: string;
  /** The page number to fetch. */
  page?: number;
  /** The number of items per page. */
  pageSize?: number;
  /** An array of tag IDs to filter items by. */
  tags?: number[];
  /** An array of location IDs to filter items by. */
  locations?: number[];
  /** A string specifying the ordering of results (e.g., 'name', '-purchase_date'). */
  ordering?: string;
}

/**
 * Represents parameters for exporting items to a file (e.g., CSV).
 */
export interface ExportItemsParams {
  /** A search query string to filter items for export. */
  query?: string;
  /** An array of tag IDs to filter items for export. */
  tags?: number[];
  /** An array of location IDs to filter items for export. */
  locations?: number[];
  /** A string specifying the ordering of items for export. */
  ordering?: string;
}

/**
 * Represents options for fetching a QR code.
 */
export interface FetchQrCodeOptions {
  /** If true, the server should return the QR code as a downloadable file. */
  download?: boolean;
}
