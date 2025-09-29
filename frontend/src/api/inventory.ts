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

export const fetchItem = async (id: number): Promise<Item> => {
  const { data } = await apiClient.get<Item>(`/items/${id}/`);
  return data;
};

export const fetchItemByAssetTag = async (assetTag: string): Promise<Item> => {
  const { data } = await apiClient.get<Item>(`/items/lookup_by_tag/${encodeURIComponent(assetTag)}/`);
  return data;
};

export interface FetchItemQrCodeOptions {
  download?: boolean;
}

export const fetchItemQrCode = async (itemId: number, options: FetchItemQrCodeOptions = {}): Promise<Blob> => {
  const params = options.download ? { download: '1' } : undefined;
  const { data } = await apiClient.get<Blob>(`/items/${itemId}/generate_qr_code/`, {
    responseType: 'blob',
    params,
  });
  return data;
};

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

export const fetchLists = async (): Promise<ItemList[]> => {
  const { data } = await apiClient.get<ItemList[]>('/lists/');
  return data;
};

export const fetchTags = async (): Promise<Tag[]> => {
  const { data } = await apiClient.get<Tag[]>('/tags/');
  return data;
};

export const fetchLocations = async (): Promise<Location[]> => {
  const { data } = await apiClient.get<Location[]>('/locations/');
  return data;
};

export const createTag = async (name: string): Promise<Tag> => {
  const { data } = await apiClient.post<Tag>('/tags/', { name });
  return data;
};

export const deleteTag = async (id: number): Promise<void> => {
  await apiClient.delete(`/tags/${id}/`);
};

export const createLocation = async (name: string): Promise<Location> => {
  const { data } = await apiClient.post<Location>('/locations/', { name });
  return data;
};

export const deleteLocation = async (id: number): Promise<void> => {
  await apiClient.delete(`/locations/${id}/`);
};

export const createItem = async (itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.post<Item>('/items/', itemData);
  return data;
};

export const createList = async (name: string): Promise<ItemList> => {
  const { data } = await apiClient.post<ItemList>('/lists/', { name });
  return data;
};

export const deleteList = async (id: number): Promise<void> => {
  await apiClient.delete(`/lists/${id}/`);
};

export const updateListItems = async (listId: number, itemIds: number[]): Promise<ItemList> => {
  const { data } = await apiClient.patch<ItemList>(`/lists/${listId}/`, { items: itemIds });
  return data;
};

export const updateItem = async (id: number, itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.put<Item>(`/items/${id}/`, itemData);
  return data;
};

export const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/items/${id}/`);
};

export const uploadItemImage = async (itemId: number, file: File): Promise<ItemImage> => {
  const formData = new FormData();
  formData.append('item', String(itemId));
  formData.append('image', file);

  const { data } = await apiClient.post<ItemImage>('/item-images/', formData);

  return data;
};
