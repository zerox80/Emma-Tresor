import type { Item, PaginatedResponse } from "../types/inventory";

export const createItem = (id: number, name = `Item ${id}`): Item => ({
  id,
  name,
  description: null,
  quantity: 1,
  purchase_date: null,
  value: null,
  asset_tag: `asset-${id}`,
  location: null,
  tags: [],
  images: [],
  wodis_inventory_number: null,
  employee_name: null,
  room_number: null,
});

export const createPage = (items: Item[]): PaginatedResponse<Item> => ({
  count: items.length,
  next: null,
  previous: null,
  results: items,
});
