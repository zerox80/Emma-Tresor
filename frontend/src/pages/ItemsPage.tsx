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
import { deleteItem, exportItems, fetchItem, updateListItems } from '../api/inventory.js';
import type { Item } from '../types/inventory.js';
import ItemsEmptyState from '../features/items/components/ItemsEmptyState.js';
import ItemsInfoBanner from '../features/items/components/ItemsInfoBanner.js';
import ItemsLoadingGrid from '../features/items/components/ItemsLoadingGrid.js';
import ItemsPageHeader from '../features/items/components/ItemsPageHeader.js';
import ItemsPaginationControls from '../features/items/components/ItemsPaginationControls.js';
import { ITEMS_PAGE_SIZE } from '../features/items/constants.js';
import { useItemLists } from '../features/items/hooks/useItemLists.js';
import { useItemSelection } from '../features/items/hooks/useItemSelection.js';
import { useItemsData } from '../features/items/hooks/useItemsData.js';
import { useItemsFilters } from '../features/items/hooks/useItemsFilters.js';
import { useItemsMetadata } from '../features/items/hooks/useItemsMetadata.js';
import { extractDetailMessage } from '../features/items/utils/itemHelpers.js';

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

  const [exportingItems, setExportingItems] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location.name])), [
    locations,
  ]);

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
        />

        {selectionMode && (
          <SelectionToolbar
            selectedCount={selectedItemIds.length}
            areAllSelectedOnPage={areAllSelectedOnPage}
            onToggleSelectAllCurrentPage={selectAllCurrentPage}
            onClearSelection={clearSelection}
            onOpenAssignSheet={handleOpenAssignSheet}
          />
        )}

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

        {loadingItems && <ItemsLoadingGrid />}

        {!loadingItems && items.length === 0 && !itemsError && <ItemsEmptyState onCreateItem={handleOpenCreateDialog} />}

        {!loadingItems && items.length > 0 && viewMode === 'grid' && (
          <ItemsGrid
            items={items}
            locationMap={locationMap}
            tagMap={tagMap}
            onOpenDetails={handleOpenItemDetails}
            selectionMode={selectionMode}
            selectedItemIds={selectedItemIds}
            onToggleItemSelected={toggleItemSelected}
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
            onToggleSelectAllCurrentPage={selectAllCurrentPage}
            selectedItemIds={selectedItemIds}
            onToggleItemSelected={toggleItemSelected}
          />
        )}

        <ItemsPaginationControls
          page={page}
          pagination={pagination}
          loading={loadingItems}
          onPrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => prev + 1)}
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
