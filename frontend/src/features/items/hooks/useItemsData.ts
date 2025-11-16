import { useCallback, useState } from 'react';

import { fetchItems } from '../../../api/inventory.js';
import type { Item, PaginatedResponse } from '../../../types/inventory.js';
import { ITEMS_PAGE_SIZE } from '../constants.js';

interface UseItemsDataArgs {
  debouncedSearchTerm: string;
  ordering: string;
  page: number;
  selectedLocationIds: number[];
  selectedTagIds: number[];
}

interface UseItemsDataResult {
  items: Item[];
  pagination: PaginatedResponse<Item> | null;
  loadingItems: boolean;
  itemsError: string | null;
  loadItems: () => Promise<void>;
  itemsVersion: number;
}

export const useItemsData = ({
  debouncedSearchTerm,
  ordering,
  page,
  selectedLocationIds,
  selectedTagIds,
}: UseItemsDataArgs): UseItemsDataResult => {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Item> | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsVersion, setItemsVersion] = useState(0);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setItemsError(null);
    try {
      const response = await fetchItems({
        query: debouncedSearchTerm || undefined,
        page,
        pageSize: ITEMS_PAGE_SIZE,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      });
      setItems(response.results);
      setPagination(response);
      setItemsVersion((prev) => prev + 1);
    } catch (error) {
      setItemsError('Deine Gegenstände konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.');
    } finally {
      setLoadingItems(false);
    }
  }, [debouncedSearchTerm, ordering, page, selectedLocationIds, selectedTagIds]);

  return {
    items,
    pagination,
    loadingItems,
    itemsError,
    loadItems,
    itemsVersion,
  };
};
