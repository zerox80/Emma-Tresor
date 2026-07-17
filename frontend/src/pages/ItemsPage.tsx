import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AddItemDialog from "../components/AddItemDialog";
import ItemDetailView from "../components/ItemDetailView";
import AssignToListSheet from "../components/AssignToListSheet";
import StatisticsCards from "../components/items/StatisticsCards";
import FilterSection from "../components/items/FilterSection";
import { fetchItem } from "../api/inventory";
import type { Item } from "../types/inventory";
import ItemsInfoBanner from "../features/items/components/ItemsInfoBanner";
import ItemsPageHeader from "../features/items/components/ItemsPageHeader";
import DuplicateFinderSheet from "../features/items/components/DuplicateFinderSheet";
import {
  DUPLICATE_STRICTNESS_OPTIONS,
} from "../features/items/constants";
import ItemsListSection from "../features/items/components/ItemsListSection";
import { useItemSelection } from "../features/items/hooks/useItemSelection";
import { useItemsData } from "../features/items/hooks/useItemsData";
import { useItemsFilters } from "../features/items/hooks/useItemsFilters";
import { useItemsExport } from "../features/items/hooks/useItemsExport";
import { useItemsMetadata } from "../features/items/hooks/useItemsMetadata";
import { useItemDetails } from "../features/items/hooks/useItemDetails";
import { useItemsDuplicateController } from "../features/items/hooks/useItemsDuplicateController";
import { useItemsListAssignment } from "../features/items/hooks/useItemsListAssignment";

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

  const {
    items,
    pagination,
    stats,
    loadingItems,
    itemsError,
    loadItems,
    itemsVersion,
  } = useItemsData({
    debouncedSearchTerm,
    ordering,
    page,
    selectedLocationIds,
    selectedTagIds,
  });

  const {
    tags,
    locations,
    metaLoading,
    handleCreateTag,
    handleCreateLocation,
  } = useItemsMetadata();

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

  const { exportingItems, exportError, handleExportItems, dismissExportError } =
    useItemsExport({
      debouncedSearchTerm,
      ordering,
      selectedTagIds,
      selectedLocationIds,
    });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogItem, setDialogItem] = useState<Item | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const details = useItemDetails({
    items,
    itemsVersion,
    loadItems,
    page,
    pagination,
    setInfoMessage,
    setPage,
  });

  const duplicateController = useItemsDuplicateController({
    ordering,
    searchTerm: debouncedSearchTerm,
    selectedLocationIds,
    selectedTagIds,
  });

  const listAssignment = useItemsListAssignment({
    clearSelection,
    selectedItemIds,
    setInfoMessage,
    setSelectionMode,
  });

  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])),
    [tags],
  );
  const locationMap = useMemo(
    () =>
      Object.fromEntries(
        locations.map((location) => [location.id, location.name]),
      ),
    [locations],
  );

  const openEditDialogForItem = useCallback(
    async (itemId: number) => {
      setDialogMode("edit");
      let targetItem = items.find((current) => current.id === itemId) ?? null;
      if (!targetItem && details.detailItem?.id === itemId) {
        targetItem = details.detailItem;
      }

      if (!targetItem) {
        try {
          targetItem = await fetchItem(itemId);
        } catch (error) {
          setInfoMessage(
            "Gegenstand konnte nicht zum Bearbeiten geladen werden.",
          );
          return;
        }
      }

      setDialogItem(targetItem);
      setDialogOpen(true);
    },
    [details.detailItem, items],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogMode("create");
    setDialogItem(null);
  };

  const handleItemCreated = async (item: Item) => {
    setDialogOpen(false);
    setDialogMode("create");
    setDialogItem(null);
    setInfoMessage(`"${item.name}" wurde erfolgreich angelegt.`);
    await loadItems();
  };

  const handleItemUpdated = async (item: Item, warning?: string | null) => {
    setDialogOpen(false);
    setDialogMode("create");
    setDialogItem(null);
    const baseMessage = `"${item.name}" wurde aktualisiert.`;
    setInfoMessage(warning ? `${baseMessage} ${warning}` : baseMessage);
    await loadItems();
    details.updateVisibleItem(item);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusItemIdParam = params.get("focusItemId");
    if (!focusItemIdParam) {
      return;
    }
    const focusItemId = Number.parseInt(focusItemIdParam, 10);
    if (!Number.isNaN(focusItemId)) {
      details.openDetails(focusItemId);
    }
    params.delete("focusItemId");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch.length > 0 ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [details.openDetails, location.pathname, location.search, navigate]);

  useEffect(() => {
    type LocationState = {
      focusItemId?: number | null;
      editItemId?: number | null;
    } | null;

    const state = (location.state ?? null) as LocationState;
    if (!state) {
      return;
    }

    const focusItemId =
      typeof state.focusItemId === "number" ? state.focusItemId : null;
    const editItemId =
      typeof state.editItemId === "number" ? state.editItemId : null;

    if (focusItemId != null) {
      details.openDetails(focusItemId);
    }

    if (editItemId != null) {
      void openEditDialogForItem(editItemId);
    }

    if (focusItemId != null || editItemId != null) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
    }
  }, [
    details.openDetails,
    location.pathname,
    location.search,
    location.state,
    navigate,
    openEditDialogForItem,
  ]);

  const handleOpenCreateDialog = useCallback(() => {
    setDialogMode("create");
    setDialogItem(null);
    setDialogOpen(true);
  }, []);

  const handleEditFromDetails = useCallback(() => {
    if (!details.detailItem) {
      return;
    }
    const itemToEdit = details.detailItem;
    setDialogMode("edit");
    setDialogItem(itemToEdit);
    setDialogOpen(true);
    details.closeDetails();
  }, [details]);

  const totalItemsCount = stats?.total_items ?? pagination?.count ?? items.length;
  const totalQuantity =
    stats?.total_quantity ??
    items.reduce((sum, current) => sum + current.quantity, 0);
  const parsedTotalValue = Number.parseFloat(stats?.total_value ?? "0");
  const totalValue = Number.isFinite(parsedTotalValue) ? parsedTotalValue : 0;

  return (
    <div className="relative space-y-8">
      {infoMessage && (
        <ItemsInfoBanner
          message={infoMessage}
          onDismiss={() => setInfoMessage(null)}
        />
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
          onOpenDuplicateFinder={duplicateController.open}
          duplicateAlertCount={duplicateController.alertCount}
        />

        <ItemsListSection
          selectionMode={selectionMode}
          selectedCount={selectedItemIds.length}
          selectedItemIds={selectedItemIds}
          areAllSelectedOnPage={areAllSelectedOnPage}
          onToggleSelectAllCurrentPage={selectAllCurrentPage}
          onClearSelection={clearSelection}
          onOpenAssignSheet={listAssignment.open}
          itemsError={itemsError}
          onRetryLoadItems={() => void loadItems()}
          exportError={exportError}
          onDismissExportError={dismissExportError}
          loadingItems={loadingItems}
          items={items}
          viewMode={viewMode}
          locationMap={locationMap}
          tagMap={tagMap}
          onOpenItemDetails={details.openDetails}
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
        open={listAssignment.isOpen}
        onClose={listAssignment.close}
        lists={listAssignment.lists}
        loading={listAssignment.listsLoading}
        error={listAssignment.listsError}
        onReload={listAssignment.loadLists}
        onAssign={listAssignment.assign}
        assignLoading={listAssignment.assignLoading}
        assignError={listAssignment.assignError}
        selectedCount={selectedItemIds.length}
        onCreateList={listAssignment.createList}
      />

      <DuplicateFinderSheet
        open={duplicateController.isOpen}
        onClose={duplicateController.close}
        duplicates={duplicateController.duplicates}
        loading={duplicateController.duplicatesLoading}
        error={duplicateController.duplicatesError}
        presetUsed={duplicateController.presetUsed}
        analyzedCount={duplicateController.analyzedCount}
        limit={duplicateController.limit}
        onRetry={duplicateController.loadDuplicates}
        onOpenItemDetails={details.openDetails}
        onMarkFalsePositive={duplicateController.markFalsePositive}
        markingGroupId={duplicateController.markingGroupId}
        quarantineEntries={duplicateController.quarantineEntries}
        quarantineLoading={duplicateController.quarantineLoading}
        quarantineError={duplicateController.quarantineError}
        onReloadQuarantine={duplicateController.loadQuarantine}
        onReleaseEntry={duplicateController.releaseEntry}
        releasingEntryId={duplicateController.releasingEntryId}
        strictness={duplicateController.strictness}
        strictnessOptions={DUPLICATE_STRICTNESS_OPTIONS}
        onStrictnessChange={duplicateController.setStrictness}
      />

      {details.detailItemId !== null && (
        <ItemDetailView
          item={details.detailItem}
          loading={details.detailLoading}
          error={details.detailError}
          onClose={details.closeDetails}
          onEdit={handleEditFromDetails}
          onRetry={details.retryDetails}
          onDelete={details.removeItem}
          deleteLoading={details.deleteLoading}
          deleteError={details.deleteError}
          tagMap={tagMap}
          locationMap={locationMap}
          onNavigatePrevious={details.navigatePrevious}
          onNavigateNext={details.navigateNext}
          canNavigatePrevious={details.canNavigatePrevious}
          canNavigateNext={details.canNavigateNext}
          navigationDirection={details.navigationDirection}
          positionInfo={details.positionInfo}
        />
      )}

      {duplicateController.undoEntries && (
        <div
          className={[
            "fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 rounded-2xl border",
            "border-slate-200 bg-white/95 px-4 py-3 shadow-lg sm:px-6",
          ].join(" ")}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Duplikate ausgeblendet
              </p>
              <p className="text-xs text-slate-500">
                Du kannst das rückgängig machen.
              </p>
              {duplicateController.undoError && (
                <p className="mt-1 text-xs text-red-600">
                  {duplicateController.undoError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-800"
                onClick={duplicateController.dismissUndo}
              >
                Verwerfen
              </button>
              <button
                type="button"
                className={[
                  "rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition",
                  "hover:bg-brand-600 disabled:bg-brand-300",
                ].join(" ")}
                onClick={() => void duplicateController.undoFalsePositive()}
                disabled={duplicateController.undoInProgress}
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
