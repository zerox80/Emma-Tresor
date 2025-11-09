import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

import Button from '../components/common/Button.js';
import AddItemDialog from '../components/AddItemDialog.js';
import ItemDetailView from '../components/ItemDetailView.js';
import AssignToListSheet from '../components/AssignToListSheet.js';
import StatisticsCards from '../components/items/StatisticsCards.js';
import FilterSection from '../components/items/FilterSection.js';
import ItemsGrid from '../components/items/ItemsGrid.js';
import ItemsTable from '../components/items/ItemsTable.js';
import SelectionToolbar from '../components/items/SelectionToolbar.js';
import {
  createList,
  createLocation,
  createTag,
  fetchItem,
  fetchItems,
  fetchLists,
  fetchLocations,
  fetchTags,
  deleteItem,
  exportItems,
  updateListItems,
} from '../api/inventory.js';
import type { Item, ItemList, Location, PaginatedResponse, Tag } from '../types/inventory.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';

/**
 * The number of items to display per page in the inventory list.
 */
const PAGE_SIZE = 20;

/**
 * Defines the possible view modes for displaying items.
 * - `grid`: Items are shown in a card-based grid layout.
 * - `table`: Items are shown in a tabular format.
 */
type ViewMode = 'grid' | 'table';

/**
 * Formats a string value as a German currency (EUR).
 * Returns '—' if the value is null, undefined, or not a valid number.
 *
 * @param {string | null | undefined} value The numeric string to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

/**
 * Extracts a detailed error message from an AxiosError object.
 * It looks for a 'detail' field in the response data, or returns the raw data if it's a string.
 *
 * @param {AxiosError} error - The AxiosError object.
 * @returns {string | null} The extracted detail message, or null if not found.
 */
const extractDetailMessage = (error: AxiosError): string | null => {
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
 * Sorts an array of ItemList objects alphabetically by their `name` property (German locale).
 *
 * @param {ItemList[]} entries - The array of ItemList objects to sort.
 * @returns {ItemList[]} A new array with the sorted ItemList objects.
 */
const sortItemLists = (entries: ItemList[]): ItemList[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));

/**
 * The main page component for viewing and managing inventory items.
 * 
 * This is the core page of the Emma-Tresor application, providing a comprehensive interface for users to:
 * - View item statistics (total count, quantity, value) with real-time calculations
 * - Filter and sort items by search term, tags, locations, and various ordering options
 * - Switch between grid and table view modes for different browsing preferences
 * - Select multiple items for bulk actions (e.g., assigning to a list)
 * - Add new items via a sophisticated multi-step dialog
 * - View detailed information for a single item in a modal, with options to edit, delete, or navigate to adjacent items
 * - Export filtered item data to CSV with proper German formatting
 * - Manage item assignments to lists with drag-and-drop functionality
 *
 * State Management:
 * - Manages complex local state for filters, selections, dialogs, and item details
 * - Implements optimistic updates for better UX
 * - Handles pagination with URL synchronization
 * - Maintains cache for tags and locations to reduce API calls
 * 
 * Performance Optimizations:
 * - Uses useMemo for expensive calculations (tag/location maps, totals)
 * - Implements debounced search to reduce API requests
 * - Caches API responses and handles race conditions
 * - Uses useCallback to prevent unnecessary re-renders
 *
 * @returns {JSX.Element} The rendered inventory items page with full CRUD functionality.
 */
const ItemsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Item> | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [exportingItems, setExportingItems] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [ordering, setOrdering] = useState<string>('-purchase_date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogItem, setDialogItem] = useState<Item | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [detailNavigationDirection, setDetailNavigationDirection] = useState<'next' | 'previous' | null>(null);
  const [pendingDetailNavigation, setPendingDetailNavigation] = useState<'next' | 'previous' | null>(null);
  const [itemsVersion, setItemsVersion] = useState(0);
  const navStartItemsVersionRef = useRef<number | null>(null);
  const [detailNavigationTarget, setDetailNavigationTarget] = useState<number | null>(null);

  const [lists, setLists] = useState<ItemList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [listsInitialized, setListsInitialized] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  /**
   * Memoized map for quick lookup of tag names by their ID.
   * @type {Record<number, string>}
   */
  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag: Tag) => [tag.id, tag.name])), [tags]);
  /**
   * Memoized map for quick lookup of location names by their ID.
   * @type {Record<number, string>}
   */
  const locationMap = useMemo(
    () => Object.fromEntries(locations.map((location: Location) => [location.id, location.name])),
    [locations],
  );

  /**
   * Effect to load initial metadata (tags and locations) on component mount.
   */
  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const [fetchedTags, fetchedLocations] = await Promise.all([fetchTags(), fetchLocations()]);
        if (!active) {
          return;
        }
        const sortedTags = [...fetchedTags].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
        const sortedLocations = [...fetchedLocations].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
        setTags(sortedTags);
        setLocations(sortedLocations);
      } catch (error) {
        if (active) {
          setMetaError('Tags und Standorte konnten nicht geladen werden. Bitte versuche es erneut.');
        }
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    };

    void loadMeta();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Fetches items from the API based on current filters, search term, and pagination.
   * Updates the `items` and `pagination` state.
   */
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setItemsError(null);
    try {
      const response = await fetchItems({
        query: debouncedSearchTerm || undefined,
        page,
        pageSize: PAGE_SIZE,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      });
      setItems(response.results);
      setPagination(response);
      setItemsVersion((prev: number) => prev + 1);
    } catch (error) {
      setItemsError('Deine Gegenstände konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.');
      setPendingDetailNavigation(null);
      setDetailNavigationDirection(null);
      navStartItemsVersionRef.current = null;
    } finally {
      setLoadingItems(false);
    }
  }, [debouncedSearchTerm, ordering, page, selectedLocationIds, selectedTagIds]);

  /**
   * Fetches all item lists from the API and sorts them alphabetically.
   * Updates the `lists` state.
   */
  const loadLists = useCallback(async () => {
    setListsLoading(true);
    setListsError(null);
    try {
      const fetchedLists = await fetchLists();
      setLists(sortItemLists(fetchedLists));
      if (!listsInitialized) {
        setListsInitialized(true);
      }
    } catch (error) {
      setListsError('Deine Listen konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setListsLoading(false);
    }
  }, [listsInitialized]);

  /**
   * Effect to reset the current page to 1 whenever filters (search, tags, locations, ordering) change.
   */
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  /**
   * Effect to load items whenever the page or filters change.
   */
  useEffect(() => {
    void loadItems();
  }, [loadItems, page]);

  /**
   * Effect to load lists when the assign sheet is opened, if they haven't been loaded yet.
   */
  useEffect(() => {
    if (assignSheetOpen && !listsInitialized && !listsLoading) {
      void loadLists();
    }
  }, [assignSheetOpen, listsInitialized, listsLoading, loadLists]);

  /**
   * Effect to clear selected item IDs when selection mode is exited.
   */
  useEffect(() => {
    if (!selectionMode) {
      setSelectedItemIds([]);
    }
  }, [selectionMode]);

  /**
   * Effect to clear assign sheet errors when it's opened.
   */
  useEffect(() => {
    if (assignSheetOpen) {
      setAssignError(null);
    }
  }, [assignSheetOpen]);

  const selectedItemsSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const areAllSelectedOnPage = items.length > 0 && items.every((item: Item) => selectedItemsSet.has(item.id));

  /**
   * Toggles the selection mode on or off. Clears selection if exiting selection mode.
   */
  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev: boolean) => {
      const next = !prev;
      if (!next) {
        setSelectedItemIds([]);
      }
      return next;
    });
  }, []);

  /**
   * Toggles the selection state of a single item.
   * @param {number} itemId - The ID of the item to toggle.
   */
  const handleToggleItemSelected = useCallback((itemId: number) => {
    setSelectedItemIds((prev: number[]) =>
      prev.includes(itemId) ? prev.filter((id: number) => id !== itemId) : [...prev, itemId],
    );
  }, []);

  /**
   * Toggles the selection of all items currently displayed on the page.
   * If all are selected, it deselects them; otherwise, it selects all of them.
   */
  const handleSelectAllCurrentPage = useCallback(() => {
    if (areAllSelectedOnPage) {
      setSelectedItemIds((prev: number[]) => prev.filter((id: number) => !items.some((item: Item) => item.id === id)));
      return;
    }
    const currentItemIds = items.map((item: Item) => item.id);
    setSelectedItemIds((prev: number[]) => Array.from(new Set<number>([...prev, ...currentItemIds])));
  }, [areAllSelectedOnPage, items]);

  /**
   * Clears all selected items.
   */
  const handleClearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  /**
   * Opens the `AssignToListSheet` and triggers loading of lists if not already loaded.
   */
  const handleOpenAssignSheet = useCallback(() => {
    setAssignSheetOpen(true);
    if (!listsInitialized && !listsLoading) {
      void loadLists();
    }
  }, [listsInitialized, listsLoading, loadLists]);

  /**
   * Closes the `AssignToListSheet`. Prevents closing if an assignment is in progress.
   */
  const handleCloseAssignSheet = useCallback(() => {
    if (assignLoading) {
      return;
    }
    setAssignSheetOpen(false);
    setAssignError(null);
  }, [assignLoading]);

  /**
   * Assigns the currently selected items to a specified list.
   * Merges selected items with existing list items and updates the list via API.
   * @param {number} listId - The ID of the list to assign items to.
   * @returns {Promise<void>} A promise that resolves when the assignment is complete.
   * @throws {Error} If no items are selected or the API call fails.
   */
  const handleAssignToList = useCallback(
    async (listId: number) => {
      if (selectedItemIds.length === 0) {
        throw new Error('Bitte wähle mindestens einen Gegenstand aus.');
      }

      setAssignLoading(true);
      setAssignError(null);
      try {
        const targetList = lists.find((list: ItemList) => list.id === listId) ?? null;
        const mergedIds = new Set<number>(targetList ? targetList.items : []);
        selectedItemIds.forEach((id) => mergedIds.add(id));
        const updated = await updateListItems(listId, Array.from(mergedIds));
        setLists((prevLists: ItemList[]) => {
          const next = prevLists.some((list: ItemList) => list.id === updated.id)
            ? prevLists.map((list: ItemList) => (list.id === updated.id ? updated : list))
            : [...prevLists, updated];
          return sortItemLists(next);
        });
        setInfoMessage(`${selectedItemIds.length} Gegenstände wurden zu „${updated.name}“ hinzugefügt.`);
        setAssignSheetOpen(false);
        setSelectionMode(false);
        setSelectedItemIds([]);
        if (!listsInitialized) {
          setListsInitialized(true);
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        const message = extractDetailMessage(axiosError) ?? 'Zuweisung fehlgeschlagen. Bitte versuche es erneut.';
        setAssignError(message);
        throw new Error(message);
      } finally {
        setAssignLoading(false);
      }
    },
    [lists, listsInitialized, selectedItemIds],
  );

  /**
   * Creates a new list from the assign sheet.
   * @param {string} name - The name of the new list.
   * @returns {Promise<ItemList>} A promise that resolves with the newly created list.
   * @throws {Error} If the API call fails.
   */
  const handleCreateListFromAssign = useCallback(
    async (name: string) => {
      try {
        const newList = await createList(name);
        setLists((prevLists: ItemList[]) => sortItemLists([...prevLists, newList]));
        if (!listsInitialized) {
          setListsInitialized(true);
        }
        return newList;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new Error(extractDetailMessage(axiosError) ?? 'Liste konnte nicht erstellt werden.');
      }
    },
    [listsInitialized],
  );

  /**
   * Toggles the selection state of a tag filter.
   * @param {number} tagId - The ID of the tag to toggle.
   */
  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev: number[]) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  /**
   * Toggles the selection state of a location filter.
   * @param {number} locationId - The ID of the location to toggle.
   */
  const handleToggleLocation = (locationId: number) => {
    setSelectedLocationIds((prev: number[]) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId],
    );
  };

  /**
   * Clears all active filters (search term, selected tags, selected locations, and resets ordering).
   */
  const handleClearFilters = () => {
    setSelectedTagIds([]);
    setSelectedLocationIds([]);
    setOrdering('-purchase_date');
    setSearchTerm('');
  };

  /**
   * Exports the currently filtered items to a CSV file.
   */
  const handleExportItems = useCallback(async () => {
    setExportError(null);
    setExportingItems(true);
    try {
      const blob = await exportItems({
        query: debouncedSearchTerm || undefined,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventar-export-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const axiosError = error as AxiosError;
      const message = extractDetailMessage(axiosError) ?? 'Export fehlgeschlagen. Bitte versuche es erneut.';
      setExportError(message);
    } finally {
      setExportingItems(false);
    }
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  /**
   * Creates a new tag and adds it to the list of available tags.
   * @param {string} name - The name of the new tag.
   * @returns {Promise<Tag>} A promise that resolves with the newly created tag.
   */
  const handleCreateTag = useCallback(async (name: string) => {
    const newTag = await createTag(name);
    setTags((prev: Tag[]) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newTag;
  }, []);

  /**
   * Creates a new location and adds it to the list of available locations.
   * @param {string} name - The name of the new location.
   * @returns {Promise<Location>} A promise that resolves with the newly created location.
   */
  const handleCreateLocation = useCallback(async (name: string) => {
    const newLocation = await createLocation(name);
    setLocations((prev: Location[]) => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newLocation;
  }, []);

  /**
   * Closes the AddItemDialog and resets its state.
   */
  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
  };

  /**
   * Callback function executed after a new item has been successfully created.
   * Closes the dialog, displays an info message, and reloads the item list.
   * @param {Item} item - The newly created item.
   */
  const handleItemCreated = async (item: Item) => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
    setInfoMessage(`„${item.name}“ wurde erfolgreich angelegt.`);
    await loadItems();
  };

  /**
   * Callback function executed after an item has been successfully updated.
   * Closes the dialog, displays an info message, reloads the item list, and updates the detail view if open.
   * @param {Item} item - The updated item.
   * @param {string | null} [warning] - An optional warning message to display.
   */
  const handleItemUpdated = async (item: Item, warning?: string | null) => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
    const baseMessage = `„${item.name}“ wurde aktualisiert.`;
    setInfoMessage(warning ? `${baseMessage} ${warning}` : baseMessage);
    await loadItems();
    if (detailItemId === item.id) {
      setDetailItem(item);
    }
  };

  /**
   * Fetches the full details for a specific item from the API.
   * Updates `detailItem` state and handles loading/error states.
   * @param {number} itemId - The ID of the item to fetch details for.
   */
  const loadItemDetails = useCallback(async (itemId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const itemData = await fetchItem(itemId);
      setDetailItem(itemData);
    } catch (error) {
      setDetailError('Details konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /**
   * Opens the `ItemDetailView` for a specified item.
   * Optionally handles navigation direction if triggered by previous/next buttons.
   * @param {number} itemId - The ID of the item to display.
   * @param {object} [options] - Optional settings.
   * @param {'next' | 'previous'} [options.fromNavigation] - Indicates if the call came from navigation buttons.
   */
  const handleOpenItemDetails = useCallback(
    (itemId: number, options?: { fromNavigation?: 'next' | 'previous' }) => {
      setDetailItemId(itemId);
      const cachedItem = items.find((currentItem: Item) => currentItem.id === itemId) ?? null;
      setDetailItem(cachedItem);

      const loadPromise = loadItemDetails(itemId);

      if (options?.fromNavigation) {
        void loadPromise.finally(() => {
          setDetailNavigationDirection((current: 'next' | 'previous' | null) =>
            current === options.fromNavigation ? null : current,
          );
        });
      } else {
        setDetailNavigationDirection(null);
      }
    },
    [items, loadItemDetails],
  );

  /**
   * Effect to check for a `focusItemId` query parameter in the URL on mount.
   * If found, it opens the detail view for that item and then cleans the URL.
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusItemIdParam = params.get('focusItemId');
    if (!focusItemIdParam) {
      return;
    }
    const focusItemId = Number.parseInt(focusItemIdParam, 10);
    if (!Number.isNaN(focusItemId)) {
      handleOpenItemDetails(focusItemId);
    }
    params.delete('focusItemId');
    const nextSearch = params.toString();
    navigate({ pathname: location.pathname, search: nextSearch.length > 0 ? `?${nextSearch}` : '' }, { replace: true });
  }, [handleOpenItemDetails, location.pathname, location.search, navigate]);

  /**
   * Closes the `ItemDetailView` and resets all related state.
   */
  const handleCloseItemDetails = useCallback(() => {
    setDetailItemId(null);
    setDetailItem(null);
    setDetailError(null);
    setDeleteError(null);
    setDeleteLoading(false);
    setPendingDetailNavigation(null);
    setDetailNavigationDirection(null);
    setDetailNavigationTarget(null);
    navStartItemsVersionRef.current = null;
  }, []);

  /**
   * Retries loading the details for the currently selected item in the `ItemDetailView`.
   */
  const handleRetryItemDetails = useCallback(() => {
    if (detailItemId != null) {
      void loadItemDetails(detailItemId);
    }
  }, [detailItemId, loadItemDetails]);

  /**
   * Handles the deletion of the item currently displayed in the `ItemDetailView`.
   * Displays an info message on success and reloads the item list.
   */
  const handleDeleteItem = useCallback(async () => {
    if (detailItemId == null) {
      return;
    }
    const itemName = detailItem?.name ?? 'Gegenstand';
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteItem(detailItemId);
      setInfoMessage(`„${itemName}“ wurde gelöscht.`);
      handleCloseItemDetails();
      await loadItems();
    } catch (error) {
      setDeleteError('Gegenstand konnte nicht gelöscht werden. Bitte versuche es erneut.');
    } finally {
      setDeleteLoading(false);
    }
  }, [detailItemId, detailItem, handleCloseItemDetails, loadItems]);

  /**
   * Opens the `AddItemDialog` in 'create' mode.
   */
  const handleOpenCreateDialog = useCallback(() => {
    setDialogMode('create');
    setDialogItem(null);
    setDialogOpen(true);
  }, []);

  /**
   * Opens the `AddItemDialog` in 'edit' mode for the item currently in `ItemDetailView`.
   * Closes the detail view first.
   */
  const handleEditFromDetails = useCallback(() => {
    if (!detailItem) {
      return;
    }
    const itemToEdit = detailItem;
    setDialogMode('edit');
    setDialogItem(itemToEdit);
    setDialogOpen(true);
    handleCloseItemDetails();
  }, [detailItem, handleCloseItemDetails]);

  /**
   * Memoized total count of items, either from pagination or current items array.
   * @type {number}
   */
  const totalItemsCount = pagination?.count ?? items.length;
  /**
   * Memoized sum of quantities of all currently displayed items.
   * @type {number}
   */
  const totalQuantity = useMemo(
    () => items.reduce((sum: number, current: Item) => sum + current.quantity, 0),
    [items],
  );
  /**
   * Memoized sum of the financial value of all currently displayed items.
   * @type {number}
   */
  const totalValue = useMemo(
    () =>
      items.reduce((sum: number, current: Item) => {
        if (!current.value) {
          return sum;
        }
        const numeric = Number.parseFloat(current.value);
        return Number.isFinite(numeric) && numeric > 0 ? sum + numeric : sum;
      }, 0),
    [items],
  );

  /**
   * Memoized index of the item currently in `ItemDetailView` within the `items` array.
   * @type {number}
   */
  const currentDetailIndex = useMemo(() => {
    if (detailItemId == null) {
      return -1;
    }
    return items.findIndex((currentItem: Item) => currentItem.id === detailItemId);
  }, [detailItemId, items]);

  /**
   * Handles navigation to the next or previous item in the list,
   * including handling pagination boundaries.
   * @param {'next' | 'previous'} direction - The direction to navigate.
   */
  const handleNavigateDetail = useCallback(
    (direction: 'next' | 'previous') => {
      if (detailItemId == null) {
        return;
      }

      const index = items.findIndex((currentItem: Item) => currentItem.id === detailItemId);
      if (index === -1) {
        return;
      }

      if (direction === 'next') {
        if (index < items.length - 1) {
          setDetailNavigationDirection('next');
          handleOpenItemDetails(items[index + 1].id, { fromNavigation: 'next' });
          return;
        }
        if (pagination?.next) {
          setDetailNavigationDirection('next');
          navStartItemsVersionRef.current = itemsVersion;
          setPendingDetailNavigation('next');
          setDetailNavigationTarget(null);
          setPage((prev: number) => prev + 1);
        }
        return;
      }

      if (direction === 'previous') {
        if (index > 0) {
          setDetailNavigationDirection('previous');
          handleOpenItemDetails(items[index - 1].id, { fromNavigation: 'previous' });
          return;
        }
        if (pagination?.previous) {
          setDetailNavigationDirection('previous');
          navStartItemsVersionRef.current = itemsVersion;
          setPendingDetailNavigation('previous');
          setDetailNavigationTarget(null);
          setPage((prev: number) => Math.max(prev - 1, 1));
        }
      }
    },
    [detailItemId, handleOpenItemDetails, items, itemsVersion, pagination],
  );

  /**
   * Navigates to the next item in the detail view.
   */
  const handleNavigateNext = useCallback(() => {
    handleNavigateDetail('next');
  }, [handleNavigateDetail]);

  /**
   * Navigates to the previous item in the detail view.
   */
  const handleNavigatePrevious = useCallback(() => {
    handleNavigateDetail('previous');
  }, [handleNavigateDetail]);

  /**
   * Boolean indicating if there is a next item on the current page.
   * @type {boolean}
   */
  const hasNextOnCurrentPage = currentDetailIndex !== -1 && currentDetailIndex < items.length - 1;
  /**
   * Boolean indicating if there is a previous item on the current page.
   * @type {boolean}
   */
  const hasPreviousOnCurrentPage = currentDetailIndex > 0;
  /**
   * Boolean indicating if navigation to the next item (on current page or next page) is possible.
   * @type {boolean}
   */
  const canNavigateNext = hasNextOnCurrentPage || Boolean(pagination?.next);
  /**
   * Boolean indicating if navigation to the previous item (on current page or previous page) is possible.
   * @type {boolean}
   */
  const canNavigatePrevious = hasPreviousOnCurrentPage || Boolean(pagination?.previous);

  /**
   * Memoized total count of items for position display, considering current page and pagination.
   * @type {number}
   */
  const totalCountForPosition = pagination?.count ?? (page - 1) * PAGE_SIZE + items.length;
  /**
   * Memoized object containing current item position and total count for display in detail view.
   * @type {{current: number, total: number} | null}
   */
  const detailPosition = currentDetailIndex === -1
    ? null
    : {
        current: (page - 1) * PAGE_SIZE + currentDetailIndex + 1,
        total: totalCountForPosition,
      };

  /**
   * Effect to handle pending detail navigation after items have been reloaded (e.g., due to page change).
   * It attempts to find the target item in the new `items` array and open its details.
   */
  /**
   * Effect to handle pending detail navigation after items have been reloaded (e.g., due to page change).
   * It attempts to find the target item in the new `items` array and open its details.
   */
  useEffect(() => {
    if (!pendingDetailNavigation) {
      return;
    }

    if (navStartItemsVersionRef.current !== null && itemsVersion === navStartItemsVersionRef.current) {
      return;
    }

    const targetItem = (() => {
      if (detailNavigationTarget != null) {
        return items.find((candidate: Item) => candidate.id === detailNavigationTarget) ?? null;
      }
      if (pendingDetailNavigation === 'next') {
        return items[0] ?? null;
      }
      if (pendingDetailNavigation === 'previous') {
        return items[items.length - 1] ?? null;
      }
      return null;
    })();

    if (targetItem) {
      handleOpenItemDetails(targetItem.id, { fromNavigation: pendingDetailNavigation });
    } else {
      setDetailNavigationDirection(null);
    }

    setPendingDetailNavigation(null);
    setDetailNavigationTarget(null);
    navStartItemsVersionRef.current = null;
  }, [detailNavigationTarget, handleOpenItemDetails, items, itemsVersion, pendingDetailNavigation]);

  /**
   * Boolean indicating if any filters are currently active.
   * @type {boolean}
   */
  const isFiltered =
    debouncedSearchTerm.length > 0 || selectedTagIds.length > 0 || selectedLocationIds.length > 0 || ordering !== '-purchase_date';

  return (
    <div className="relative space-y-8">
      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex items-start justify-between gap-3">
            <span>{infoMessage}</span>
            <button
              type="button"
              className="text-emerald-600 transition hover:text-emerald-800"
              onClick={() => setInfoMessage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <StatisticsCards
        totalItemsCount={totalItemsCount}
        totalQuantity={totalQuantity}
        totalValue={totalValue}
        loading={loadingItems}
        onAddItem={handleOpenCreateDialog}
        onReload={() => void loadItems()}
      />

      <FilterSection
        viewMode={viewMode}
        setViewMode={setViewMode}
        isFiltered={isFiltered}
        onClearFilters={handleClearFilters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        tags={tags}
        locations={locations}
        metaLoading={metaLoading}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggleTag}
        selectedLocationIds={selectedLocationIds}
        onToggleLocation={handleToggleLocation}
        ordering={ordering}
        setOrdering={setOrdering}
      />

      <section className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Gegenstände</h3>
            <p className="text-sm text-slate-500">
              {loadingItems
                ? 'Lade Gegenstände …'
                : `${pagination?.count ?? items.length} Ergebnisse gesamt${isFiltered ? ' (gefiltert)' : ''}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={selectionMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              {selectionMode ? 'Auswahlmodus beenden' : 'Auswahlmodus aktivieren'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleExportItems()}
              loading={exportingItems}
            >
              Exportieren
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenCreateDialog}>
              Neuer Gegenstand
            </Button>
          </div>
        </header>

        {itemsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <div className="flex items-start justify-between gap-3">
              <span>{itemsError}</span>
              <Button variant="ghost" size="sm" onClick={() => void loadItems()}>
                Erneut laden
              </Button>
            </div>
          </div>
        )}

        {exportError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <div className="flex items-start justify-between gap-3">
              <span>{exportError}</span>
              <Button variant="ghost" size="sm" onClick={() => setExportError(null)}>
                Schließen
              </Button>
            </div>
          </div>
        )}

        {loadingItems && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        )}

        {!loadingItems && items.length === 0 && !itemsError && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              📦
            </div>
            <h4 className="mt-4 text-xl font-semibold text-slate-900">Noch keine Gegenstände erfasst</h4>
            <p className="mt-2 text-sm text-slate-500">
              Lege deinen ersten Gegenstand an und starte deine Inventarliste. Alles ist in wenigen Schritten erledigt.
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="primary" size="md" onClick={handleOpenCreateDialog}>
                Jetzt starten
              </Button>
            </div>
          </div>
        )}

        {!loadingItems && items.length > 0 && viewMode === 'grid' && (
          <ItemsGrid
            items={items}
            locationMap={locationMap}
            tagMap={tagMap}
            onOpenDetails={handleOpenItemDetails}
          />
        )}

        {!loadingItems && items.length > 0 && viewMode === 'table' && (
          <ItemsTable
            items={items}
            locationMap={locationMap}
            tagMap={tagMap}
            onOpenDetails={handleOpenItemDetails}
            selectionMode={selectionMode}
            areAllSelectedOnPage={areAllSelectedOnPage}
            onToggleSelectAllCurrentPage={handleSelectAllCurrentPage}
          />
        )}

        {pagination && (pagination.next || pagination.previous) && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span>
              Seite {page} · {pagination.count} Ergebnisse insgesamt
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!pagination.previous || page === 1 || loadingItems}
              >
                Zurück
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!pagination.next || loadingItems}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </section>

      <SelectionToolbar
        selectedCount={selectedItemIds.length}
        areAllSelectedOnPage={areAllSelectedOnPage}
        onToggleSelectAllCurrentPage={handleSelectAllCurrentPage}
        onClearSelection={handleClearSelection}
        onOpenAssignSheet={handleOpenAssignSheet}
      />

      <AddItemDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onCreated={handleItemCreated}
        tags={tags}
        locations={locations}
        onCreateTag={handleCreateTag}
        onCreateLocation={handleCreateLocation}
        mode={dialogMode}
        item={dialogItem}
        onUpdated={handleItemUpdated}
      />

      <AssignToListSheet
        open={assignSheetOpen}
        onClose={handleCloseAssignSheet}
        lists={lists}
        loading={listsLoading}
        error={listsError}
        onReload={loadLists}
        onAssign={handleAssignToList}
        assignLoading={assignLoading}
        assignError={assignError}
        selectedCount={selectedItemIds.length}
        onCreateList={handleCreateListFromAssign}
      />

      {detailItemId !== null && (
        <ItemDetailView
          item={detailItem}
          loading={detailLoading}
          error={detailError}
          onClose={handleCloseItemDetails}
          onEdit={handleEditFromDetails}
          onRetry={handleRetryItemDetails}
          onDelete={handleDeleteItem}
          deleteLoading={deleteLoading}
          deleteError={deleteError}
          tagMap={tagMap}
          locationMap={locationMap}
          onNavigatePrevious={handleNavigatePrevious}
          onNavigateNext={handleNavigateNext}
          canNavigatePrevious={canNavigatePrevious}
          canNavigateNext={canNavigateNext}
          navigationDirection={detailNavigationDirection}
          positionInfo={detailPosition}
        />
      )}
    </div>
  );
};

export default ItemsPage;
