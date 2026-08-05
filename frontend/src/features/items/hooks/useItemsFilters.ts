import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { DEFAULT_ITEM_ORDERING, type ViewMode } from "../constants";

export interface ItemsFiltersState {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  debouncedSearchTerm: string;
  selectedTagIds: number[];
  toggleTag: (tagId: number) => void;
  selectedLocationIds: number[];
  toggleLocation: (locationId: number) => void;
  selectedEmployee: string | null;
  setSelectedEmployee: (employee: string | null) => void;
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
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<string>(DEFAULT_ITEM_ORDERING);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearchTerm,
    ordering,
    selectedEmployee,
    selectedLocationIds,
    selectedTagIds,
  ]);

  const toggleId = useCallback((prev: number[], entryId: number) => {
    if (prev.includes(entryId)) {
      return prev.filter((candidate) => candidate !== entryId);
    }
    return [...prev, entryId];
  }, []);

  const toggleTag = useCallback(
    (tagId: number) => {
      setSelectedTagIds((prev) => toggleId(prev, tagId));
    },
    [toggleId],
  );

  const toggleLocation = useCallback(
    (locationId: number) => {
      setSelectedLocationIds((prev) => toggleId(prev, locationId));
    },
    [toggleId],
  );

  const clearFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedLocationIds([]);
    setSelectedEmployee(null);
    setOrdering(DEFAULT_ITEM_ORDERING);
    setSearchTerm("");
  }, []);

  const isFiltered = useMemo(
    () =>
      debouncedSearchTerm.length > 0 ||
      selectedTagIds.length > 0 ||
      selectedLocationIds.length > 0 ||
      selectedEmployee !== null ||
      ordering !== DEFAULT_ITEM_ORDERING,
    [
      debouncedSearchTerm,
      ordering,
      selectedEmployee,
      selectedLocationIds,
      selectedTagIds,
    ],
  );

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    selectedTagIds,
    toggleTag,
    selectedLocationIds,
    toggleLocation,
    selectedEmployee,
    setSelectedEmployee,
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
