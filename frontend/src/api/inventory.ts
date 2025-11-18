// Inventory API Module
// ====================
// This module provides all API functions for interacting with the inventory management backend.
// It includes functions for items, lists, tags, locations, and image management.

import apiClient from './client';                                          // Import configured API client
import type {
  DuplicateFinderResponse,
  DuplicateQuarantineEntry,
  Item,
  ItemChangeLog,
  ItemImage,
  ItemList,
  ItemPayload,
  Location,
  PaginatedResponse,
  Tag,
} from '../types/inventory';

/**
 * Options for fetching items from the API.
 *
 * These options allow filtering, pagination, and sorting of item queries.
 */
export interface FetchItemsOptions {
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
 * Fetch a paginated list of items from the API.
 *
 * @param {FetchItemsOptions} options - Query options for filtering, pagination, and sorting
 * @returns {Promise<PaginatedResponse<Item>>} Paginated response containing items
 */
export const fetchItems = async ({
  query,                       // Search term for filtering items
  page,                        // Page number for pagination
  pageSize,                    // Number of items per page
  tags,                        // Tag IDs for filtering
  locations,                   // Location IDs for filtering
  ordering,                    // Sort order for results
}: FetchItemsOptions = {}): Promise<PaginatedResponse<Item>> => {
  // Build query parameters object
  const params: Record<string, string | number> = {};
  if (query) params.search = query;                                          // Add search parameter
  if (page) params.page = page;                                              // Add pagination
  if (pageSize) params.page_size = pageSize;                                 // Add page size
  if (tags && tags.length > 0) params.tags = tags.join(',');                 // Add tag filter as comma-separated string
  if (locations && locations.length > 0) params.location = locations.join(','); // Add location filter as comma-separated string
  if (ordering) params.ordering = ordering;                                  // Add sorting parameter

  // Make GET request to items endpoint with query parameters
  const { data } = await apiClient.get<PaginatedResponse<Item>>('/items/', { params });
  return data;                                                              // Return paginated response
};

/**
 * Fetch a single item by its ID.
 *
 * @param {number} id - The ID of the item to fetch
 * @returns {Promise<Item>} The requested item
 */
export const fetchItem = async (id: number): Promise<Item> => {
  const { data } = await apiClient.get<Item>(`/items/${id}/`);               // GET request to specific item endpoint
  return data;                                                              // Return the item data
};

/**
 * Fetch a single item by its asset tag.
 *
 * This function uses a special lookup endpoint that finds items by their unique asset tag.
 * The asset tag is URL-encoded to handle special characters safely.
 *
 * @param {string} assetTag - The asset tag of the item to fetch
 * @returns {Promise<Item>} The requested item
 */
export const fetchItemByAssetTag = async (assetTag: string): Promise<Item> => {
  // URL-encode the asset tag to handle special characters safely
  const encodedTag = encodeURIComponent(assetTag);
  const { data } = await apiClient.get<Item>(`/items/lookup_by_tag/${encodedTag}/`);
  return data;                                                              // Return the item data
};

/**
 * Options for fetching QR codes for items.
 */
export interface FetchItemQrCodeOptions {
  /** Whether to trigger a download of the QR code image */
  download?: boolean;
}

/**
 * Generate and fetch a QR code for a specific item.
 *
 * The QR code contains the item's asset tag and can be used for quick scanning.
 * Returns a Blob which can be displayed as an image or downloaded.
 *
 * @param {number} itemId - The ID of the item to generate QR code for
 * @param {FetchItemQrCodeOptions} options - Options for QR code generation
 * @returns {Promise<Blob>} The QR code image as a Blob
 */
export const fetchItemQrCode = async (itemId: number, options: FetchItemQrCodeOptions = {}): Promise<Blob> => {
  // Set download parameter if requested
  const params = options.download ? { download: '1' } : undefined;
  const { data } = await apiClient.get<Blob>(`/items/${itemId}/generate_qr_code/`, {
    responseType: 'blob',                                               // Expect binary data (image)
    params,                                                             // Query parameters
  });
  return data;                                                          // Return the image Blob
};

/**
 * Fetch all items from the API, handling pagination automatically.
 *
 * This function automatically iterates through all pages to retrieve the complete
 * list of items. Useful for exports or when you need all items at once.
 *
 * @param {string} query - Optional search query to filter items
 * @returns {Promise<Item[]>} Array containing all items
 */
export const fetchAllItems = async (query?: string): Promise<Item[]> => {
  const collected: Item[] = [];                                          // Array to store all items
  let currentPage = 1;                                                  // Start with first page
  let hasNext = true;                                                   // Flag to continue pagination

  // Continue fetching pages while there are more results
  while (hasNext) {
    // Fetch a page with 100 items (max page size for efficiency)
    const response = await fetchItems({ query, page: currentPage, pageSize: 100 });
    collected.push(...response.results);                               // Add items to collection
    hasNext = Boolean(response.next);                                  // Check if there's a next page
    currentPage += 1;                                                  // Move to next page
  }

  return collected;                                                    // Return all collected items
};

/**
 * Options for exporting items - extends FetchItemsOptions without pagination.
 */
export interface ExportItemsOptions extends Omit<FetchItemsOptions, 'page' | 'pageSize'> {}

/**
 * Export items to a file format (CSV/Excel) as a downloadable Blob.
 *
 * This function applies the same filtering options as fetchItems but exports
 * all matching items rather than returning paginated JSON.
 *
 * @param {ExportItemsOptions} options - Filter and sort options for export
 * @returns {Promise<Blob>} The exported data as a downloadable Blob
 */
export const exportItems = async ({
  query,                       // Search filter
  tags,                        // Tag filter
  locations,                   // Location filter
  ordering,                    // Sort order
}: ExportItemsOptions = {}): Promise<Blob> => {
  // Build query parameters (no pagination for exports)
  const params: Record<string, string> = {};
  if (query) params.search = query;                                          // Add search parameter
  if (tags && tags.length > 0) params.tags = tags.join(',');                 // Add tag filter
  if (locations && locations.length > 0) params.location = locations.join(','); // Add location filter
  if (ordering) params.ordering = ordering;                                  // Add sorting parameter

  // Make GET request to export endpoint
  const response = await apiClient.get<Blob>('/items/export/', {
    params,                                                             // Query parameters
    responseType: 'blob',                                               // Expect binary file data
  });
  return response.data;                                                  // Return the file Blob
};

// ==================
// List Management API
// ==================

/**
 * Fetch all item lists from the API.
 *
 * @returns {Promise<ItemList[]>} Array of all item lists
 */
export const fetchLists = async (): Promise<ItemList[]> => {
  const { data } = await apiClient.get<ItemList[]>('/lists/');              // GET request to lists endpoint
  return data;                                                              // Return lists array
};

/**
 * Export items from a specific list as a downloadable file.
 *
 * @param {number} listId - The ID of the list to export
 * @returns {Promise<Blob>} The exported list data as a downloadable Blob
 */
export const exportListItems = async (listId: number): Promise<Blob> => {
  const response = await apiClient.get<Blob>(`/lists/${listId}/export/`, {
    responseType: 'blob',                                               // Expect binary file data
  });
  return response.data;                                                  // Return the file Blob
};

// ====================
// Tags & Locations API
// ====================

/**
 * Fetch all available tags from the API.
 *
 * @returns {Promise<Tag[]>} Array of all tags
 */
export const fetchTags = async (): Promise<Tag[]> => {
  const { data } = await apiClient.get<Tag[]>('/tags/');                  // GET request to tags endpoint
  return data;                                                            // Return tags array
};

/**
 * Fetch all available locations from the API.
 *
 * @returns {Promise<Location[]>} Array of all locations
 */
export const fetchLocations = async (): Promise<Location[]> => {
  const { data } = await apiClient.get<Location[]>('/locations/');          // GET request to locations endpoint
  return data;                                                             // Return locations array
};

/**
 * Create a new tag.
 *
 * @param {string} name - The name of the new tag
 * @returns {Promise<Tag>} The created tag
 */
export const createTag = async (name: string): Promise<Tag> => {
  const { data } = await apiClient.post<Tag>('/tags/', { name });           // POST request with tag name
  return data;                                                             // Return created tag
};

/**
 * Delete a tag by its ID.
 *
 * @param {number} id - The ID of the tag to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 */
export const deleteTag = async (id: number): Promise<void> => {
  await apiClient.delete(`/tags/${id}/`);                                 // DELETE request to tag endpoint
};

/**
 * Create a new location.
 *
 * @param {string} name - The name of the new location
 * @returns {Promise<Location>} The created location
 */
export const createLocation = async (name: string): Promise<Location> => {
  const { data } = await apiClient.post<Location>('/locations/', { name }); // POST request with location name
  return data;                                                            // Return created location
};

/**
 * Delete a location by its ID.
 *
 * @param {number} id - The ID of the location to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 */
export const deleteLocation = async (id: number): Promise<void> => {
  await apiClient.delete(`/locations/${id}/`);                           // DELETE request to location endpoint
};

// =================
// Item Management API
// =================

/**
 * Create a new item in the inventory.
 *
 * @param {ItemPayload} itemData - The item data to create
 * @returns {Promise<Item>} The created item
 */
export const createItem = async (itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.post<Item>('/items/', itemData);           // POST request with item data
  return data;                                                             // Return created item
};

/**
 * Create a new item list.
 *
 * @param {string} name - The name of the new list
 * @returns {Promise<ItemList>} The created list
 */
export const createList = async (name: string): Promise<ItemList> => {
  const { data } = await apiClient.post<ItemList>('/lists/', { name });       // POST request with list name
  return data;                                                              // Return created list
};

/**
 * Delete a list by its ID.
 *
 * @param {number} id - The ID of the list to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 */
export const deleteList = async (id: number): Promise<void> => {
  await apiClient.delete(`/lists/${id}/`);                                 // DELETE request to list endpoint
};

/**
 * Update the items associated with a list.
 *
 * This function replaces all items in the list with the provided item IDs.
 *
 * @param {number} listId - The ID of the list to update
 * @param {number[]} itemIds - Array of item IDs to associate with the list
 * @returns {Promise<ItemList>} The updated list
 */
export const updateListItems = async (listId: number, itemIds: number[]): Promise<ItemList> => {
  const { data } = await apiClient.patch<ItemList>(`/lists/${listId}/`, { items: itemIds }); // PATCH with new item IDs
  return data;                                                              // Return updated list
};

/**
 * Update an existing item.
 *
 * @param {number} id - The ID of the item to update
 * @param {ItemPayload} itemData - The updated item data
 * @returns {Promise<Item>} The updated item
 */
export const updateItem = async (id: number, itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.put<Item>(`/items/${id}/`, itemData);      // PUT request with updated data
  return data;                                                              // Return updated item
};

/**
 * Delete an item by its ID.
 *
 * @param {number} id - The ID of the item to delete
 * @returns {Promise<void>} Promise that resolves when deletion is complete
 */
export const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/items/${id}/`);                                 // DELETE request to item endpoint
};

// ===============
// Image Management
// ===============

/**
 * Upload an image for a specific item.
 *
 * This function handles multipart form data for file uploads.
 *
 * @param {number} itemId - The ID of the item to upload image for
 * @param {File} file - The image file to upload
 * @returns {Promise<ItemImage>} The created image metadata
 */
export const uploadItemImage = async (itemId: number, file: File): Promise<ItemImage> => {
  // Create FormData for file upload
  const formData = new FormData();
  formData.append('item', String(itemId));                                  // Add item ID as string
  formData.append('image', file);                                           // Add image file

  // POST request with multipart form data
  const { data } = await apiClient.post<ItemImage>('/item-images/', formData);

  return data;                                                              // Return image metadata
};

// ===========
// Change Tracking
// ===========

/**
 * Fetch the change log for a specific item.
 *
 * The change log contains a history of all modifications made to the item.
 *
 * @param {number} itemId - The ID of the item to fetch change log for
 * @returns {Promise<ItemChangeLog[]>} Array of change log entries
 */
export const fetchItemChangelog = async (itemId: number): Promise<ItemChangeLog[]> => {
  const { data } = await apiClient.get<ItemChangeLog[]>(`/items/${itemId}/changelog/`); // GET request to changelog endpoint
  return data;                                                              // Return change log entries
};

// =====================
// Duplicate Finder APIs
// =====================

export interface DuplicateFinderParams {
  preset?: 'auto';
  name_match?: 'none' | 'exact' | 'prefix' | 'contains';
  description_match?: 'none' | 'exact' | 'contains';
  wodis_match?: 'none' | 'exact';
  purchase_date_tolerance_days?: number;
  limit?: number;
  require_any_text_match?: boolean;
}

export const fetchDuplicateFinder = async (
  params: DuplicateFinderParams = { preset: 'auto' },
  filters?: FetchItemsOptions,
): Promise<DuplicateFinderResponse> => {
  const requestParams: Record<string, string | number | boolean> = { ...params };

  if (filters?.query) {
    requestParams.search = filters.query;
  }
  if (filters?.tags && filters.tags.length > 0) {
    requestParams.tags = filters.tags.join(',');
  }
  if (filters?.locations && filters.locations.length > 0) {
    requestParams.location = filters.locations.join(',');
  }
  if (filters?.ordering) {
    requestParams.ordering = filters.ordering;
  }

  const { data } = await apiClient.get<DuplicateFinderResponse>('/items/duplicates/', {
    params: requestParams,
  });
  return data;
};

export interface CreateDuplicateQuarantinePayload {
  item_a_id: number;
  item_b_id: number;
  reason?: string;
  notes?: string;
}

export const createDuplicateQuarantineEntry = async (
  payload: CreateDuplicateQuarantinePayload,
): Promise<DuplicateQuarantineEntry> => {
  const { data } = await apiClient.post<DuplicateQuarantineEntry>('/duplicate-quarantine/', payload);
  return data;
};

export const fetchDuplicateQuarantineEntries = async (
  options: { is_active?: boolean } = { is_active: true },
): Promise<DuplicateQuarantineEntry[]> => {
  const { data } = await apiClient.get<DuplicateQuarantineEntry[]>('/duplicate-quarantine/', {
    params: options,
  });
  return data;
};

export const releaseDuplicateQuarantineEntry = async (entryId: number): Promise<void> => {
  await apiClient.delete(`/duplicate-quarantine/${entryId}/`);
};

export const restoreDuplicateQuarantineEntry = async (
  entryId: number,
): Promise<DuplicateQuarantineEntry> => {
  const { data } = await apiClient.post<DuplicateQuarantineEntry>(`/duplicate-quarantine/${entryId}/restore/`);
  return data;
};
