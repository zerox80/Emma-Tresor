export interface ItemImage {
  
  id: number;
  
  preview_url: string;
  
  download_url: string;
  
  filename: string;
  
  content_type: string;
  
  image: string;
}

export interface Item {
  
  id: number;
  
  name: string;
  
  description: string | null;
  
  quantity: number;
  
  purchase_date: string | null;
  
  value: string | null;
  
  asset_tag: string;
  
  location: number | null;
  
  tags: number[];
  
  images: ItemImage[];
  
  wodis_inventory_number: string | null;
}

export interface ItemPayload {
  
  name: string;
  
  description: string | null;
  
  quantity: number;
  
  purchase_date: string | null;
  
  value: string | null;
  
  location: number | null;
  
  tags: number[];
  
  wodis_inventory_number: string | null;
}

export interface Tag {
  
  id: number;
  
  name: string;
}

export interface Location {
  
  id: number;
  
  name: string;
}

export interface ItemList {
  
  id: number;
  
  name: string;
  
  items: number[];
}

export interface ItemChangeLog {
  
  id: number;
  
  created_at: string;
  
  action: string;
  
  action_display: string;
  
  user_username: string | null;
  
  changes: Record<string, any>;
}

export interface PaginatedResponse<T> {
  
  count: number;
  
  next: string | null;
  
  previous: string | null;
  
  results: T[];
}

export interface FetchItemsParams {
  
  query?: string;
  
  page?: number;
  
  pageSize?: number;
  
  tags?: number[];
  
  locations?: number[];
  
  ordering?: string;
}

export interface ExportItemsParams {
  
  query?: string;
  
  tags?: number[];
  
  locations?: number[];
  
  ordering?: string;
}

export interface FetchQrCodeOptions {
  
  download?: boolean;
}
