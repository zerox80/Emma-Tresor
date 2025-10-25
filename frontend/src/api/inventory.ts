import apiClient from './client';
import type { Item, ItemImage, ItemList, ItemPayload, Location, PaginatedResponse, Tag } from '../types/inventory';

export interface FetchItemsOptions {
  query?: string;
  page?: number;
  pageSize?: number;
  tags?: number[];
  locations?: number[];
  ordering?: string;
}

/**
 * Fetches a paginated list of items from the API.
 *
 * @param {FetchItemsOptions} [options={}] - The options for fetching items.
 * @returns {Promise<PaginatedResponse<Item>>} A promise that resolves to a paginated response of items.
 */
export const fetchItems = async ({
  query,
  page,
  pageSize,
  tags,
  locations,
  ordering,
}: FetchItemsOptions = {}): Promise<PaginatedResponse<Item>> => {
  const params: Record<string, string | number> = {};
  if (query) params.search = query;
  if (page) params.page = page;
  if (pageSize) params.page_size = pageSize;
  if (tags && tags.length > 0) params.tags = tags.join(',');
  if (locations && locations.length > 0) params.location = locations.join(',');
  if (ordering) params.ordering = ordering;
  const { data } = await apiClient.get<PaginatedResponse<Item>>('/items/', { params });
  return data;
};

/**
 * Fetches a single item by its ID.
 *
 * @param {number} id - The ID of the item to fetch.
 * @returns {Promise<Item>} A promise that resolves to the fetched item.
 */
export const fetchItem = async (id: number): Promise<Item> => {
  const { data } = await apiClient.get<Item>(`/items/${id}/`);
  return data;
};

/**
 * Fetches a single item by its asset tag.
 *
 * @param {string} assetTag - The asset tag of the item to fetch.
 * @returns {Promise<Item>} A promise that resolves to the fetched item.
 */
export const fetchItemByAssetTag = async (assetTag: string): Promise<Item> => {
  const { data } = await apiClient.get<Item>(`/items/lookup_by_tag/${encodeURIComponent(assetTag)}/`);
  return data;
};

export interface FetchItemQrCodeOptions {
  download?: boolean;
}

/**
 * Fetches the QR code for an item.
 *
 * @param {number} itemId - The ID of the item to fetch the QR code for.
 * @param {FetchItemQrCodeOptions} [options={}] - The options for fetching the QR code.
 * @returns {Promise<Blob>} A promise that resolves to the QR code image as a blob.
 */
export const fetchItemQrCode = async (itemId: number, options: FetchItemQrCodeOptions = {}): Promise<Blob> => {
  const params = options.download ? { download: '1' } : undefined;
  const { data } = await apiClient.get<Blob>(`/items/${itemId}/generate_qr_code/`, {
    responseType: 'blob',
    params,
  });
  return data;
};

/**
 * Fetches all items from the API, handling pagination.
 *
 * @param {string} [query] - An optional search query.
 * @returns {Promise<Item[]>} A promise that resolves to a list of all items.
 */
export const fetchAllItems = async (query?: string): Promise<Item[]> => {
  const collected: Item[] = [];
  let currentPage = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await fetchItems({ query, page: currentPage, pageSize: 100 });
    collected.push(...response.results);
    hasNext = Boolean(response.next);
    currentPage += 1;
  }

  return collected;
};

/**
 * Fetches all lists from the API.
 *
 * @returns {Promise<ItemList[]>} A promise that resolves to a list of all item lists.
 */
export const fetchLists = async (): Promise<ItemList[]> => {
  const { data } = await apiClient.get<ItemList[]>('/lists/');
  return data;
};

/**
 * Fetches all tags from the API.
 *
 * @returns {Promise<Tag[]>} A promise that resolves to a list of all tags.
 */
export const fetchTags = async (): Promise<Tag[]> => {
  const { data } = await apiClient.get<Tag[]>('/tags/');
  return data;
};

/**
 * Fetches all locations from the API.
 *
 * @returns {Promise<Location[]>} A promise that resolves to a list of all locations.
 */
export const fetchLocations = async (): Promise<Location[]> => {
  const { data } = await apiClient.get<Location[]>('/locations/');
  return data;
};

/**
 * Creates a new tag.
 *
 * @param {string} name - The name of the tag to create.
 * @returns {Promise<Tag>} A promise that resolves to the created tag.
 */
export const createTag = async (name: string): Promise<Tag> => {
  const { data } = await apiClient.post<Tag>('/tags/', { name });
  return data;
};

/**
 * Deletes a tag.
 *
 * @param {number} id - The ID of the tag to delete.
 * @returns {Promise<void>} A promise that resolves when the tag is deleted.
 */
export const deleteTag = async (id: number): Promise<void> => {
  await apiClient.delete(`/tags/${id}/`);
};

/**
 * Creates a new location.
 *
 * @param {string} name - The name of the location to create.
 * @returns {Promise<Location>} A promise that resolves to the created location.
 */
export const createLocation = async (name: string): Promise<Location> => {
  const { data } = await apiClient.post<Location>('/locations/', { name });
  return data;
};

/**
 * Deletes a location.
 *
 * @param {number} id - The ID of the location to delete.
 * @returns {Promise<void>} A promise that resolves when the location is deleted.
 */
export const deleteLocation = async (id: number): Promise<void> => {
  await apiClient.delete(`/locations/${id}/`);
};

/**
 * Creates a new item.
 *
 * @param {ItemPayload} itemData - The data for the item to create.
 * @returns {Promise<Item>} A promise that resolves to the created item.
 */
export const createItem = async (itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.post<Item>('/items/', itemData);
  return data;
};

/**
 * Creates a new list.
 *
 * @param {string} name - The name of the list to create.
 * @returns {Promise<ItemList>} A promise that resolves to the created list.
 */
export const createList = async (name: string): Promise<ItemList> => {
  const { data } = await apiClient.post<ItemList>('/lists/', { name });
  return data;
};

/**
 * Deletes a list.
 *
 * @param {number} id - The ID of the list to delete.
 * @returns {Promise<void>} A promise that resolves when the list is deleted.
 */
export const deleteList = async (id: number): Promise<void> => {
  await apiClient.delete(`/lists/${id}/`);
};

/**
 * Updates the items in a list.
 *
 * @param {number} listId - The ID of the list to update.
 * @param {number[]} itemIds - The new list of item IDs.
 * @returns {Promise<ItemList>} A promise that resolves to the updated list.
 */
export const updateListItems = async (listId: number, itemIds: number[]): Promise<ItemList> => {
  const { data } = await apiClient.patch<ItemList>(`/lists/${listId}/`, { items: itemIds });
  return data;
};

/**
 * Updates an item.
 *
 * @param {number} id - The ID of the item to update.
 * @param {ItemPayload} itemData - The new data for the item.
 * @returns {Promise<Item>} A promise that resolves to the updated item.
 */
export const updateItem = async (id: number, itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.put<Item>(`/items/${id}/`, itemData);
  return data;
};

/**
 * Deletes an item.
 *
 * @param {number} id - The ID of the item to delete.
 * @returns {Promise<void>} A promise that resolves when the item is deleted.
 */
export const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/items/${id}/`);
};

/**
 * Uploads an image for an item.
 *
 * @param {number} itemId - The ID of the item to upload the image for.
 * @param {File} file - The image file to upload.
 * @returns {Promise<ItemImage>} A promise that resolves to the created item image.
 */
export const uploadItemImage = async (itemId: number, file: File): Promise<ItemImage> => {
  const formData = new FormData();
  formData.append('item', String(itemId));
  formData.append('image', file);

  const { data } = await apiClient.post<ItemImage>('/item-images/', formData);

  return data;
};
