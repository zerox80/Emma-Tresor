import { useCallback, useRef, useState } from "react";

import { fetchItems, fetchItemStats } from "../../../api/inventory";
import type {
  Item,
  ItemStats,
  PaginatedResponse,
} from "../../../types/inventory";
import { ITEMS_PAGE_SIZE } from "../constants";

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
  stats: ItemStats | null;
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
  const [pagination, setPagination] = useState<PaginatedResponse<Item> | null>(
    null,
  );
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsVersion, setItemsVersion] = useState(0);
  const latestRequestId = useRef(0);

  const loadItems = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoadingItems(true);
    setItemsError(null);
    try {
      const filters = {
        query: debouncedSearchTerm || undefined,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations:
          selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      };
      const [response, aggregateStats] = await Promise.all([
        fetchItems({
          ...filters,
          page,
          pageSize: ITEMS_PAGE_SIZE,
        }),
        fetchItemStats(filters),
      ]);
      if (requestId === latestRequestId.current) {
        setItems(response.results);
        setPagination(response);
        setStats(aggregateStats);
        setItemsVersion((prev) => prev + 1);
      }
    } catch (error) {
      if (requestId === latestRequestId.current) {
        setItemsError(
          "Deine Gegenstände konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.",
        );
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoadingItems(false);
      }
    }
  }, [
    debouncedSearchTerm,
    ordering,
    page,
    selectedLocationIds,
    selectedTagIds,
  ]);

  return {
    items,
    pagination,
    stats,
    loadingItems,
    itemsError,
    loadItems,
    itemsVersion,
  };
};
