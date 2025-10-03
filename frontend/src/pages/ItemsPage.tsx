import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';

import Button from '../components/common/Button';
import AddItemDialog from '../components/AddItemDialog';
import ItemDetailView from '../components/ItemDetailView';
import AssignToListSheet from '../components/AssignToListSheet';
import StatisticsCards from '../components/items/StatisticsCards';
import FilterSection from '../components/items/FilterSection';
import ItemsGrid from '../components/items/ItemsGrid';
import ItemsTable from '../components/items/ItemsTable';
import SelectionToolbar from '../components/items/SelectionToolbar';
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
  updateListItems,
} from '../api/inventory';
import type { Item, ItemList, Location, PaginatedResponse, Tag } from '../types/inventory';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const PAGE_SIZE = 20;

type ViewMode = 'grid' | 'table';

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

const sortItemLists = (entries: ItemList[]): ItemList[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));

const ItemsPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Item> | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

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

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
    [locations],
  );

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
      setItemsVersion((prev) => prev + 1);
    } catch (error) {
      setItemsError('Deine Gegenstände konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.');
      setPendingDetailNavigation(null);
      setDetailNavigationDirection(null);
      navStartItemsVersionRef.current = null;
    } finally {
      setLoadingItems(false);
    }
  }, [debouncedSearchTerm, ordering, page, selectedLocationIds, selectedTagIds]);

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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  useEffect(() => {
    void loadItems();
  }, [loadItems, page]);

  useEffect(() => {
    if (assignSheetOpen && !listsInitialized && !listsLoading) {
      void loadLists();
    }
  }, [assignSheetOpen, listsInitialized, listsLoading, loadLists]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedItemIds([]);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (assignSheetOpen) {
      setAssignError(null);
    }
  }, [assignSheetOpen]);

  const selectedItemsSet = useMemo<Set<number>>(() => new Set<number>(selectedItemIds), [selectedItemIds]);
  const hasSelection = selectedItemIds.length > 0;
  const areAllSelectedOnPage = items.length > 0 && items.every((item: Item) => selectedItemsSet.has(item.id));

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedItemIds([]);
      }
      return next;
    });
  }, []);

  const handleToggleItemSelected = useCallback((itemId: number) => {
    setSelectedItemIds((prev: number[]) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }, []);

  const handleSelectAllCurrentPage = useCallback(() => {
    if (areAllSelectedOnPage) {
      setSelectedItemIds((prev: number[]) => prev.filter((id) => !items.some((item) => item.id === id)));
      return;
    }
    const currentItemIds = items.map((item: Item) => item.id);
    setSelectedItemIds((prev: number[]) => Array.from(new Set<number>([...prev, ...currentItemIds])));
  }, [areAllSelectedOnPage, items]);

  const handleClearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  const handleOpenAssignSheet = useCallback(() => {
    setAssignSheetOpen(true);
    if (!listsInitialized && !listsLoading) {
      void loadLists();
    }
  }, [listsInitialized, listsLoading, loadLists]);

  const handleCloseAssignSheet = useCallback(() => {
    if (assignLoading) {
      return;
    }
    setAssignSheetOpen(false);
    setAssignError(null);
  }, [assignLoading]);

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
          const next = prevLists.some((list) => list.id === updated.id)
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

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev: number[]) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleToggleLocation = (locationId: number) => {
    setSelectedLocationIds((prev: number[]) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId],
    );
  };

  const handleClearFilters = () => {
    setSelectedTagIds([]);
    setSelectedLocationIds([]);
    setOrdering('-purchase_date');
    setSearchTerm('');
  };

  const handleCreateTag = useCallback(async (name: string) => {
    const newTag = await createTag(name);
    setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newTag;
  }, []);

  const handleCreateLocation = useCallback(async (name: string) => {
    const newLocation = await createLocation(name);
    setLocations((prev) => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newLocation;
  }, []);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
  };

  const handleItemCreated = async (item: Item) => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
    setInfoMessage(`„${item.name}“ wurde erfolgreich angelegt.`);
    await loadItems();
  };

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

  const handleOpenItemDetails = useCallback(
    (itemId: number, options?: { fromNavigation?: 'next' | 'previous' }) => {
      setDetailItemId(itemId);
      const cachedItem = items.find((currentItem) => currentItem.id === itemId) ?? null;
      setDetailItem(cachedItem);

      const loadPromise = loadItemDetails(itemId);

      if (options?.fromNavigation) {
        void loadPromise.finally(() => {
          setDetailNavigationDirection((current) =>
            current === options.fromNavigation ? null : current,
          );
        });
      } else {
        setDetailNavigationDirection(null);
      }
    },
    [items, loadItemDetails],
  );

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

  const handleRetryItemDetails = useCallback(() => {
    if (detailItemId != null) {
      void loadItemDetails(detailItemId);
    }
  }, [detailItemId, loadItemDetails]);

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

  const handleOpenCreateDialog = useCallback(() => {
    setDialogMode('create');
    setDialogItem(null);
    setDialogOpen(true);
  }, []);

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

  const totalItemsCount = pagination?.count ?? items.length;
  const totalQuantity = useMemo(
    () => items.reduce((sum: number, current: Item) => sum + current.quantity, 0),
    [items],
  );
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

  const currentDetailIndex = useMemo(() => {
    if (detailItemId == null) {
      return -1;
    }
    return items.findIndex((currentItem: Item) => currentItem.id === detailItemId);
  }, [detailItemId, items]);

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
          setPage((prev) => prev + 1);
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
          setPage((prev) => Math.max(prev - 1, 1));
        }
      }
    },
    [detailItemId, handleOpenItemDetails, items, itemsVersion, pagination],
  );

  const handleNavigateNext = useCallback(() => {
    handleNavigateDetail('next');
  }, [handleNavigateDetail]);

  const handleNavigatePrevious = useCallback(() => {
    handleNavigateDetail('previous');
  }, [handleNavigateDetail]);

  const hasNextOnCurrentPage = currentDetailIndex !== -1 && currentDetailIndex < items.length - 1;
  const hasPreviousOnCurrentPage = currentDetailIndex > 0;
  const canNavigateNext = hasNextOnCurrentPage || Boolean(pagination?.next);
  const canNavigatePrevious = hasPreviousOnCurrentPage || Boolean(pagination?.previous);

  const totalCountForPosition = pagination?.count ?? (page - 1) * PAGE_SIZE + items.length;
  const detailPosition = currentDetailIndex === -1
    ? null
    : {
        current: (page - 1) * PAGE_SIZE + currentDetailIndex + 1,
        total: totalCountForPosition,
      };

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
