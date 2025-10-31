export interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ItemImage {
  id: number;
  item: number;
  download_url: string;
  preview_url: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  image?: string | null;
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  quantity: number;
  purchase_date: string | null;
  value: string | null;
  asset_tag: string;
  owner: number;
  location: number | null;
  wodis_inventory_number: string | null;
  tags: number[];
  images: ItemImage[];
  created_at: string;
  updated_at: string;
}

export interface ItemPayload {
  name: string;
  description: string | null;
  quantity: number;
  purchase_date: string | null;
  value: string | null;
  location: number | null;
  wodis_inventory_number: string | null;
  tags: number[];
}

export interface ItemList {
  id: number;
  name: string;
  items: number[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ItemChangeLog {
  id: number;
  item: number | null;
  item_name: string;
  user: number | null;
  user_username: string | null;
  action: 'create' | 'update' | 'delete';
  action_display: string;
  changes: Record<string, any>;
  created_at: string;
}
