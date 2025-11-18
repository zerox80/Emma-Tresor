import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Item } from '../../../types/inventory';

interface UseItemSelectionResult {
  selectionMode: boolean;
  setSelectionMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  selectedItemIds: number[];
  selectedItemsSet: Set<number>;
  areAllSelectedOnPage: boolean;
  toggleSelectionMode: () => void;
  toggleItemSelected: (itemId: number) => void;
  selectAllCurrentPage: () => void;
  clearSelection: () => void;
}

export const useItemSelection = (items: Item[]): UseItemSelectionResult => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedItemIds([]);
    }
  }, [selectionMode]);

  const selectedItemsSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const areAllSelectedOnPage = useMemo(
    () => items.length > 0 && items.every((item) => selectedItemsSet.has(item.id)),
    [items, selectedItemsSet],
  );

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedItemIds([]);
      }
      return next;
    });
  }, []);

  const toggleItemSelected = useCallback((itemId: number) => {
    setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }, []);

  const selectAllCurrentPage = useCallback(() => {
    if (areAllSelectedOnPage) {
      setSelectedItemIds((prev) => prev.filter((id) => !items.some((item) => item.id === id)));
      return;
    }
    const currentItemIds = items.map((item) => item.id);
    setSelectedItemIds((prev) => Array.from(new Set<number>([...prev, ...currentItemIds])));
  }, [areAllSelectedOnPage, items]);

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  return {
    selectionMode,
    setSelectionMode,
    selectedItemIds,
    selectedItemsSet,
    areAllSelectedOnPage,
    toggleSelectionMode,
    toggleItemSelected,
    selectAllCurrentPage,
    clearSelection,
  };
};
