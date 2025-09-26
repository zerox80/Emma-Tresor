import apiClient from './client';
import type { Item, ItemList, ItemPayload, Location, PaginatedResponse, Tag } from '../types/inventory';

export interface FetchItemsOptions {
  query?: string;
  page?: number;
  pageSize?: number;
}

export const fetchItems = async ({ query, page, pageSize }: FetchItemsOptions = {}): Promise<PaginatedResponse<Item>> => {
  const params: Record<string, string | number> = {};
  if (query) params.search = query;
  if (page) params.page = page;
  if (pageSize) params.page_size = pageSize;
  const { data } = await apiClient.get<PaginatedResponse<Item>>('/items/', { params });
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

export const updateItem = async (id: number, itemData: ItemPayload): Promise<Item> => {
  const { data } = await apiClient.put<Item>(`/items/${id}/`, itemData);
  return data;
};

export const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/items/${id}/`);
};
