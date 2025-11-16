import React from 'react';

import Button from '../../../components/common/Button.js';
import ItemsGrid from '../../../components/items/ItemsGrid.js';
import ItemsTable from '../../../components/items/ItemsTable.js';
import SelectionToolbar from '../../../components/items/SelectionToolbar.js';
import type { Item, PaginatedResponse } from '../../../types/inventory.js';
import type { ViewMode } from '../constants.js';
import ItemsEmptyState from './ItemsEmptyState.js';
import ItemsLoadingGrid from './ItemsLoadingGrid.js';
import ItemsPaginationControls from './ItemsPaginationControls.js';

interface ItemsListSectionProps {
  selectionMode: boolean;
  selectedCount: number;
  selectedItemIds: number[];
  areAllSelectedOnPage: boolean;
  onToggleSelectAllCurrentPage: () => void;
  onClearSelection: () => void;
  onOpenAssignSheet: () => void;
  itemsError: string | null;
  onRetryLoadItems: () => void;
  exportError: string | null;
  onDismissExportError: () => void;
  loadingItems: boolean;
  items: Item[];
  viewMode: ViewMode;
  locationMap: Record<number, string>;
  tagMap: Record<number, string>;
  onOpenItemDetails: (itemId: number) => void;
  onToggleItemSelected: (itemId: number) => void;
  onCreateItem: () => void;
  pagination: PaginatedResponse<Item> | null;
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

const ItemsListSection: React.FC<ItemsListSectionProps> = ({
  selectionMode,
  selectedCount,
  selectedItemIds,
  areAllSelectedOnPage,
  onToggleSelectAllCurrentPage,
  onClearSelection,
  onOpenAssignSheet,
  itemsError,
  onRetryLoadItems,
  exportError,
  onDismissExportError,
  loadingItems,
  items,
  viewMode,
  locationMap,
  tagMap,
  onOpenItemDetails,
  onToggleItemSelected,
  onCreateItem,
  pagination,
  page,
  onPreviousPage,
  onNextPage,
}) => (
  <div className="space-y-4">
    {selectionMode && (
      <SelectionToolbar
        selectedCount={selectedCount}
        areAllSelectedOnPage={areAllSelectedOnPage}
        onToggleSelectAllCurrentPage={onToggleSelectAllCurrentPage}
        onClearSelection={onClearSelection}
        onOpenAssignSheet={onOpenAssignSheet}
      />
    )}

    {itemsError && (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <div className="flex items-start justify-between gap-3">
          <span>{itemsError}</span>
          <Button variant="ghost" size="sm" onClick={onRetryLoadItems}>
            Erneut laden
          </Button>
        </div>
      </div>
    )}

    {exportError && (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <div className="flex items-start justify-between gap-3">
          <span>{exportError}</span>
          <Button variant="ghost" size="sm" onClick={onDismissExportError}>
            Schließen
          </Button>
        </div>
      </div>
    )}

    {loadingItems && <ItemsLoadingGrid />}

    {!loadingItems && items.length === 0 && !itemsError && <ItemsEmptyState onCreateItem={onCreateItem} />}

    {!loadingItems && items.length > 0 && viewMode === 'grid' && (
      <ItemsGrid
        items={items}
        locationMap={locationMap}
        tagMap={tagMap}
        onOpenDetails={onOpenItemDetails}
        selectionMode={selectionMode}
        selectedItemIds={selectedItemIds}
        onToggleItemSelected={onToggleItemSelected}
      />
    )}

    {!loadingItems && items.length > 0 && viewMode === 'table' && (
      <ItemsTable
        items={items}
        locationMap={locationMap}
        tagMap={tagMap}
        onOpenDetails={onOpenItemDetails}
        selectionMode={selectionMode}
        areAllSelectedOnPage={areAllSelectedOnPage}
        onToggleSelectAllCurrentPage={onToggleSelectAllCurrentPage}
        selectedItemIds={selectedItemIds}
        onToggleItemSelected={onToggleItemSelected}
      />
    )}

    <ItemsPaginationControls
      page={page}
      pagination={pagination}
      loading={loadingItems}
      onPrevious={onPreviousPage}
      onNext={onNextPage}
    />
  </div>
);

export default ItemsListSection;
