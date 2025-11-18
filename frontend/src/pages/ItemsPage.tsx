import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

import AddItemDialog from '../components/AddItemDialog';
import ItemDetailView from '../components/ItemDetailView';
import AssignToListSheet from '../components/AssignToListSheet';
import StatisticsCards from '../components/items/StatisticsCards';
import FilterSection from '../components/items/FilterSection';
import { deleteItem, fetchItem, updateListItems } from '../api/inventory';
import type { DuplicateFinderParams } from '../api/inventory';
import type { Item, DuplicateGroup } from '../types/inventory';
import ItemsInfoBanner from '../features/items/components/ItemsInfoBanner';
import ItemsPageHeader from '../features/items/components/ItemsPageHeader';
import DuplicateFinderSheet from '../features/items/components/DuplicateFinderSheet';
import {
  DUPLICATE_STRICTNESS_OPTIONS,
  DEFAULT_DUPLICATE_STRICTNESS,
  ITEMS_PAGE_SIZE,
} from '../features/items/constants';
import type { DuplicateStrictnessLevel } from '../features/items/constants';
import ItemsListSection from '../features/items/components/ItemsListSection';
import { useItemLists } from '../features/items/hooks/useItemLists';
import { useItemSelection } from '../features/items/hooks/useItemSelection';
import { useItemsData } from '../features/items/hooks/useItemsData';
import { useItemsFilters } from '../features/items/hooks/useItemsFilters';
import { useItemsExport } from '../features/items/hooks/useItemsExport';
import { useItemsMetadata } from '../features/items/hooks/useItemsMetadata';
import { useDuplicateFinder } from '../features/items/hooks/useDuplicateFinder';
import type { DuplicateQuarantineEntry } from '../types/inventory';
import { extractDetailMessage } from '../features/items/utils/itemHelpers';

const ItemsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
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
  } = useItemsFilters();

  const { items, pagination, loadingItems, itemsError, loadItems, itemsVersion } = useItemsData({
    debouncedSearchTerm,
    ordering,
    page,
    selectedLocationIds,
    selectedTagIds,
  });

  const { tags, locations, metaLoading, handleCreateTag, handleCreateLocation } = useItemsMetadata();

  const { lists, listsLoading, listsError, loadLists, maybeLoadLists, upsertList, createNewList } = useItemLists();

  const {
    selectionMode,
    setSelectionMode,
    selectedItemIds,
    areAllSelectedOnPage,
    toggleSelectionMode,
    toggleItemSelected,
    selectAllCurrentPage,
    clearSelection,
  } = useItemSelection(items);

  const { exportingItems, exportError, handleExportItems, dismissExportError } = useItemsExport({
    debouncedSearchTerm,
    ordering,
    selectedTagIds,
    selectedLocationIds,
  });

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
  const navStartItemsVersionRef = useRef<number | null>(null);
  const [detailNavigationTarget, setDetailNavigationTarget] = useState<number | null>(null);

  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [duplicateSheetOpen, setDuplicateSheetOpen] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<number | null>(null);
  const [releasingEntryId, setReleasingEntryId] = useState<number | null>(null);
  const [undoEntries, setUndoEntries] = useState<DuplicateQuarantineEntry[] | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [undoInProgress, setUndoInProgress] = useState(false);
  const undoSnackbarTimerRef = useRef<number | null>(null);
  const [duplicateStrictness, setDuplicateStrictness] = useState<DuplicateStrictnessLevel>(DEFAULT_DUPLICATE_STRICTNESS);

  const duplicateFinderParams = useMemo<DuplicateFinderParams>(() => {
    const option = DUPLICATE_STRICTNESS_OPTIONS.find((candidate) => candidate.id === duplicateStrictness);
    return option?.params ?? { preset: 'auto' };
  }, [duplicateStrictness]);

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location.name])), [
    locations,
  ]);

  const openEditDialogForItem = useCallback(
    async (itemId: number) => {
      setDialogMode('edit');
      let targetItem = items.find((current) => current.id === itemId) ?? null;
      if (!targetItem && detailItem?.id === itemId) {
        targetItem = detailItem;
      }

      if (!targetItem) {
        try {
          targetItem = await fetchItem(itemId);
        } catch (error) {
          setInfoMessage('Gegenstand konnte nicht zum Bearbeiten geladen werden.');
          return;
        }
      }

      setDialogItem(targetItem);
      setDialogOpen(true);
    },
    [detailItem, items],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (assignSheetOpen) {
      setAssignError(null);
      void maybeLoadLists();
    }
  }, [assignSheetOpen, maybeLoadLists]);

  const handleOpenAssignSheet = useCallback(() => {
    setAssignSheetOpen(true);
    void maybeLoadLists();
  }, [maybeLoadLists]);

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
        const targetList = lists.find((list) => list.id === listId) ?? null;
        const mergedIds = new Set<number>(targetList ? targetList.items : []);
        selectedItemIds.forEach((id) => mergedIds.add(id));
        const updated = await updateListItems(listId, Array.from(mergedIds));
        upsertList(updated);
        setInfoMessage(`${selectedItemIds.length} Gegenstände wurden zu "${updated.name}" hinzugefügt.`);
        setAssignSheetOpen(false);
        setSelectionMode(false);
        clearSelection();
      } catch (error) {
        const axiosError = error as AxiosError;
        const message = extractDetailMessage(axiosError) ?? 'Zuweisung fehlgeschlagen. Bitte versuche es erneut.';
        setAssignError(message);
        throw new Error(message);
      } finally {
        setAssignLoading(false);
      }
    },
    [clearSelection, lists, selectedItemIds, setSelectionMode, upsertList],
  );

  const handleCreateListFromAssign = useCallback(async (name: string) => createNewList(name), [createNewList]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
  };

  const handleItemCreated = async (item: Item) => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
    setInfoMessage(`"${item.name}" wurde erfolgreich angelegt.`);
    await loadItems();
  };

  const handleItemUpdated = async (item: Item, warning?: string | null) => {
    setDialogOpen(false);
    setDialogMode('create');
    setDialogItem(null);
    const baseMessage = `"${item.name}" wurde aktualisiert.`;
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
          setDetailNavigationDirection((current) => (current === options.fromNavigation ? null : current));
        });
      } else {
        setDetailNavigationDirection(null);
      }
    },
    [items, loadItemDetails],
  );

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

  useEffect(() => {
    type LocationState = {
      focusItemId?: number | null;
      editItemId?: number | null;
    } | null;

    const state = (location.state ?? null) as LocationState;
    if (!state) {
      return;
    }

    const focusItemId = typeof state.focusItemId === 'number' ? state.focusItemId : null;
    const editItemId = typeof state.editItemId === 'number' ? state.editItemId : null;

    if (focusItemId != null) {
      handleOpenItemDetails(focusItemId);
    }

    if (editItemId != null) {
      void openEditDialogForItem(editItemId);
    }

    if (focusItemId != null || editItemId != null) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [handleOpenItemDetails, location.pathname, location.search, location.state, navigate, openEditDialogForItem]);

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
      setInfoMessage(`"${itemName}" wurde gelöscht.`);
      handleCloseItemDetails();
      await loadItems();
    } catch (error) {
      setDeleteError('Gegenstand konnte nicht gelöscht werden. Bitte versuche es erneut.');
    } finally {
      setDeleteLoading(false);
    }
  }, [detailItem, detailItemId, handleCloseItemDetails, loadItems]);

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

  const totalQuantity = useMemo(() => items.reduce((sum, current) => sum + current.quantity, 0), [items]);

  const totalValue = useMemo(
    () =>
      items.reduce((sum, current) => {
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
    return items.findIndex((currentItem) => currentItem.id === detailItemId);
  }, [detailItemId, items]);

  const handleNavigateDetail = useCallback(
    (direction: 'next' | 'previous') => {
      if (detailItemId == null) {
        return;
      }

      const index = items.findIndex((currentItem) => currentItem.id === detailItemId);
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
    [detailItemId, handleOpenItemDetails, items, itemsVersion, pagination, setPage],
  );

  const handleNavigateNext = useCallback(() => {
    handleNavigateDetail('next');
  }, [handleNavigateDetail]);

  const handleNavigatePrevious = useCallback(() => {
    handleNavigateDetail('previous');
  }, [handleNavigateDetail]);

  const {
    duplicates,
    duplicatesLoading,
    duplicatesError,
    presetUsed: duplicatePreset,
    analyzedCount: duplicateAnalyzedCount,
    limit: duplicateLimit,
    loadDuplicates,
    markGroupAsFalsePositive,
    quarantineEntries,
    quarantineLoading,
    quarantineError,
    loadQuarantine,
    releaseQuarantineEntry,
  } = useDuplicateFinder({
    searchTerm: debouncedSearchTerm,
    selectedTagIds,
    selectedLocationIds,
    ordering,
    finderParams: duplicateFinderParams,
  });

  const duplicateAlertCount = duplicates.length;

  useEffect(() => {
    if (duplicateSheetOpen) {
      void loadQuarantine();
    }
  }, [duplicateSheetOpen, loadQuarantine]);

  const hasNextOnCurrentPage = currentDetailIndex !== -1 && currentDetailIndex < items.length - 1;

  const hasPreviousOnCurrentPage = currentDetailIndex > 0;

  const canNavigateNext = hasNextOnCurrentPage || Boolean(pagination?.next);

  const canNavigatePrevious = hasPreviousOnCurrentPage || Boolean(pagination?.previous);

  const totalCountForPosition = pagination?.count ?? (page - 1) * ITEMS_PAGE_SIZE + items.length;

  const detailPosition = currentDetailIndex === -1
    ? null
    : {
        current: (page - 1) * ITEMS_PAGE_SIZE + currentDetailIndex + 1,
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
        return items.find((candidate) => candidate.id === detailNavigationTarget) ?? null;
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

  const handleOpenDuplicateFinder = useCallback(() => {
    setDuplicateSheetOpen(true);
  }, []);

  const handleCloseDuplicateFinder = useCallback(() => {
    setDuplicateSheetOpen(false);
  }, []);

  const handleDuplicateStrictnessChange = useCallback((level: DuplicateStrictnessLevel) => {
    setDuplicateStrictness(level);
  }, []);

  const handleMarkGroupAsFalsePositive = useCallback(
    async (group: DuplicateGroup) => {
      try {
        setMarkingGroupId(group.group_id);
        const createdEntries = await markGroupAsFalsePositive(group);
        if (createdEntries.length > 0) {
          setUndoEntries(createdEntries);
          setUndoError(null);
        }
        await loadDuplicates();
      } catch (error) {
        setUndoError('Duplikate konnten nicht ausgeblendet werden.');
      } finally {
        setMarkingGroupId(null);
      }
    },
    [loadDuplicates, markGroupAsFalsePositive],
  );

  const handleReleaseQuarantineEntry = useCallback(
    async (entryId: number) => {
      try {
        setReleasingEntryId(entryId);
        await releaseQuarantineEntry(entryId);
        await loadDuplicates();
      } catch (error) {
        setUndoError('Eintrag konnte nicht wiederhergestellt werden.');
      } finally {
        setReleasingEntryId(null);
      }
    },
    [loadDuplicates, releaseQuarantineEntry],
  );

  const handleUndoFalsePositive = useCallback(async () => {
    if (!undoEntries || undoInProgress) {
      return;
    }
    try {
      setUndoInProgress(true);
      await Promise.all(undoEntries.map((entry) => releaseQuarantineEntry(entry.id)));
      setUndoEntries(null);
      await loadDuplicates();
    } catch (error) {
      setUndoError('Rückgängig konnte nicht durchgeführt werden.');
    } finally {
      setUndoInProgress(false);
    }
  }, [loadDuplicates, releaseQuarantineEntry, undoEntries, undoInProgress]);

  const handleDismissUndoSnackbar = useCallback(() => {
    setUndoEntries(null);
    setUndoError(null);
  }, []);

  useEffect(() => {
    if (!undoEntries) {
      if (undoSnackbarTimerRef.current) {
        window.clearTimeout(undoSnackbarTimerRef.current);
        undoSnackbarTimerRef.current = null;
      }
      return;
    }
    undoSnackbarTimerRef.current = window.setTimeout(() => {
      setUndoEntries(null);
      setUndoError(null);
      undoSnackbarTimerRef.current = null;
    }, 7000);
    return () => {
      if (undoSnackbarTimerRef.current) {
        window.clearTimeout(undoSnackbarTimerRef.current);
        undoSnackbarTimerRef.current = null;
      }
    };
  }, [undoEntries]);

  return (
    <div className="relative space-y-8">
      {infoMessage && <ItemsInfoBanner message={infoMessage} onDismiss={() => setInfoMessage(null)} />}

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
        onClearFilters={clearFilters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        tags={tags}
        locations={locations}
        metaLoading={metaLoading}
        selectedTagIds={selectedTagIds}
        onToggleTag={toggleTag}
        selectedLocationIds={selectedLocationIds}
        onToggleLocation={toggleLocation}
        ordering={ordering}
        setOrdering={setOrdering}
      />

      <section className="space-y-4">
        <ItemsPageHeader
          totalCount={pagination?.count ?? items.length}
          loadingItems={loadingItems}
          isFiltered={isFiltered}
          selectionMode={selectionMode}
          selectedCount={selectedItemIds.length}
          onToggleSelectionMode={toggleSelectionMode}
          onExport={() => void handleExportItems()}
          exporting={exportingItems}
          onCreateItem={handleOpenCreateDialog}
          onOpenDuplicateFinder={handleOpenDuplicateFinder}
          duplicateAlertCount={duplicateAlertCount}
        />

        <ItemsListSection
          selectionMode={selectionMode}
          selectedCount={selectedItemIds.length}
          selectedItemIds={selectedItemIds}
          areAllSelectedOnPage={areAllSelectedOnPage}
          onToggleSelectAllCurrentPage={selectAllCurrentPage}
          onClearSelection={clearSelection}
          onOpenAssignSheet={handleOpenAssignSheet}
          itemsError={itemsError}
          onRetryLoadItems={() => void loadItems()}
          exportError={exportError}
          onDismissExportError={dismissExportError}
          loadingItems={loadingItems}
          items={items}
          viewMode={viewMode}
          locationMap={locationMap}
          tagMap={tagMap}
          onOpenItemDetails={handleOpenItemDetails}
          onToggleItemSelected={toggleItemSelected}
          onCreateItem={handleOpenCreateDialog}
          pagination={pagination}
          page={page}
          onPreviousPage={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNextPage={() => setPage((prev) => prev + 1)}
        />
      </section>

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

      <DuplicateFinderSheet
        open={duplicateSheetOpen}
        onClose={handleCloseDuplicateFinder}
        duplicates={duplicates}
        loading={duplicatesLoading}
        error={duplicatesError}
        presetUsed={duplicatePreset}
        analyzedCount={duplicateAnalyzedCount}
        limit={duplicateLimit}
        onRetry={() => loadDuplicates()}
        onOpenItemDetails={handleOpenItemDetails}
        onMarkFalsePositive={handleMarkGroupAsFalsePositive}
        markingGroupId={markingGroupId}
        quarantineEntries={quarantineEntries}
        quarantineLoading={quarantineLoading}
        quarantineError={quarantineError}
        onReloadQuarantine={() => loadQuarantine()}
        onReleaseEntry={handleReleaseQuarantineEntry}
        releasingEntryId={releasingEntryId}
        strictness={duplicateStrictness}
        strictnessOptions={DUPLICATE_STRICTNESS_OPTIONS}
        onStrictnessChange={handleDuplicateStrictnessChange}
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

      {undoEntries && (
        <div
          className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg sm:px-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Duplikate ausgeblendet</p>
              <p className="text-xs text-slate-500">Du kannst das rückgängig machen.</p>
              {undoError && <p className="mt-1 text-xs text-red-600">{undoError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-800"
                onClick={handleDismissUndoSnackbar}
              >
                Verwerfen
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:bg-brand-300"
                onClick={() => void handleUndoFalsePositive()}
                disabled={undoInProgress}
              >
                Rückgängig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
