import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { DEFAULT_ITEM_ORDERING, type ViewMode } from '../constants.js';

export interface ItemsFiltersState {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  debouncedSearchTerm: string;
  selectedTagIds: number[];
  toggleTag: (tagId: number) => void;
  selectedLocationIds: number[];
  toggleLocation: (locationId: number) => void;
  ordering: string;
  setOrdering: (value: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  page: number;
  setPage: (next: number | ((prev: number) => number)) => void;
  isFiltered: boolean;
  clearFilters: () => void;
}

export const useItemsFilters = (): ItemsFiltersState => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [ordering, setOrdering] = useState<string>(DEFAULT_ITEM_ORDERING);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  const toggleId = useCallback((prev: number[], entryId: number) => {
    if (prev.includes(entryId)) {
      return prev.filter((candidate) => candidate !== entryId);
    }
    return [...prev, entryId];
  }, []);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => toggleId(prev, tagId));
  }, [toggleId]);

  const toggleLocation = useCallback((locationId: number) => {
    setSelectedLocationIds((prev) => toggleId(prev, locationId));
  }, [toggleId]);

  const clearFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedLocationIds([]);
    setOrdering(DEFAULT_ITEM_ORDERING);
    setSearchTerm('');
  }, []);

  const isFiltered = useMemo(
    () =>
      debouncedSearchTerm.length > 0 ||
      selectedTagIds.length > 0 ||
      selectedLocationIds.length > 0 ||
      ordering !== DEFAULT_ITEM_ORDERING,
    [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds],
  );

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    selectedTagIds,
    toggleTag,
    selectedLocationIds,
    toggleLocation,
    ordering,
    setOrdering,
    viewMode,
    setViewMode,
    page,
    setPage,
    isFiltered,
    clearFilters,
  };
};
