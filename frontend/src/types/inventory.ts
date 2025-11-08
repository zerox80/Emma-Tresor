/**
 * Represents a tag that can be associated with an item.
 */
export interface Tag {
  /** The unique ID of the tag. */
  id: number;
  /** The name of the tag. */
  name: string;
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
}

/**
 * Represents a location where an item can be stored.
 */
export interface Location {
  /** The unique ID of the location. */
  id: number;
  /** The name of the location. */
  name: string;
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
}

/**
 * Represents an image associated with an item.
 */
export interface ItemImage {
  /** The unique ID of the image. */
  id: number;
  /** The ID of the item this image belongs to. */
  item: number;
  /** The URL to download the image. */
  download_url: string;
  /** The URL to preview the image. */
  preview_url: string;
  /** The name of the image file. */
  filename: string;
  /** The content type of the image. */
  content_type: string;
  /** The size of the image in bytes. */
  size: number;
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
  /** The path to the image file (optional). */
  image?: string | null;
}

/**
 * Represents an item in the inventory.
 */
export interface Item {
  /** The unique ID of the item. */
  id: number;
  /** The name of the item. */
  name: string;
  /** A description of the item. */
  description: string | null;
  /** The quantity of the item. */
  quantity: number;
  /** The date the item was purchased. */
  purchase_date: string | null;
  /** The value of the item. */
  value: string | null;
  /** A unique identifier for the item. */
  asset_tag: string;
  /** The ID of the user who owns the item. */
  owner: number;
  /** The ID of the location where the item is stored. */
  location: number | null;
  /** An optional inventory number from an external system. */
  wodis_inventory_number: string | null;
  /** A list of tag IDs associated with the item. */
  tags: number[];
  /** A list of images associated with the item. */
  images: ItemImage[];
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
}

/**
 * Represents the payload for creating or updating an item.
 */
export interface ItemPayload {
  /** The name of the item. */
  name: string;
  /** A description of the item. */
  description: string | null;
  /** The quantity of the item. */
  quantity: number;
  /** The date the item was purchased. */
  purchase_date: string | null;
  /** The value of the item. */
  value: string | null;
  /** The ID of the location where the item is stored. */
  location: number | null;
  /** An optional inventory number from an external system. */
  wodis_inventory_number: string | null;
  /** A list of tag IDs associated with the item. */
  tags: number[];
}

/**
 * Represents a list of items.
 */
export interface ItemList {
  /** The unique ID of the list. */
  id: number;
  /** The name of the list. */
  name: string;
  /** A list of item IDs in the list. */
  items: number[];
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
}

/**
 * Represents a paginated response from the API.
 * @template T The type of the items in the response.
 */
export interface PaginatedResponse<T> {
  /** The total number of items. */
  count: number;
  /** The URL of the next page, or null if there is no next page. */
  next: string | null;
  /** The URL of the previous page, or null if there is no previous page. */
  previous: string | null;
  /** The list of items on the current page. */
  results: T[];
}

/**
 * Represents a log of changes made to an item.
 */
export interface ItemChangeLog {
  /** The unique ID of the change log. */
  id: number;
  /** The ID of the item that was changed. */
  item: number | null;
  /** The name of the item at the time of the change. */
  item_name: string;
  /** The ID of the user who made the change. */
  user: number | null;
  /** The username of the user who made the change. */
  user_username: string | null;
  /** The action that was performed. */
  action: 'create' | 'update' | 'delete';
  /** The display name of the action. */
  action_display: string;
  /** A JSON object describing the changes made. */
  changes: Record<string, any>;
  /** The creation timestamp. */
  created_at: string;
}
