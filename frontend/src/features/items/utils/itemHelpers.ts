import type { AxiosError } from 'axios';

import type { ItemList } from '../../../types/inventory';

/**
 * Extracts a meaningful message from Axios error responses that follow DRF's `{ detail }` format.
 */
export const extractDetailMessage = (error: AxiosError): string | null => {
  const data = error.response?.data;
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return null;
};

/**
 * Creates a locale aware copy of the provided list array sorted by name.
 */
export const sortItemLists = (entries: ItemList[]): ItemList[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
