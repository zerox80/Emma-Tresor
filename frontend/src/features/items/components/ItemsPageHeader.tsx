import React from 'react';

import Button from '../../../components/common/Button.js';

interface ItemsPageHeaderProps {
  totalCount: number;
  loadingItems: boolean;
  isFiltered: boolean;
  selectionMode: boolean;
  selectedCount: number;
  onToggleSelectionMode: () => void;
  onExport: () => void;
  exporting: boolean;
  onCreateItem: () => void;
}

const ItemsPageHeader: React.FC<ItemsPageHeaderProps> = ({
  totalCount,
  loadingItems,
  isFiltered,
  selectionMode,
  selectedCount,
  onToggleSelectionMode,
  onExport,
  exporting,
  onCreateItem,
}) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Gegenstände</h3>
      <p className="text-sm text-slate-500">
        {loadingItems
          ? 'Lade Gegenstände …'
          : `${totalCount} Ergebnisse gesamt${isFiltered ? ' (gefiltert)' : ''}.`}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={selectionMode ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onToggleSelectionMode}
      >
        {selectionMode ? 'Auswahlmodus beenden' : 'Auswahlmodus aktivieren'}
      </Button>
      {selectionMode && selectedCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
          {selectedCount} ausgewählt
        </span>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={onExport} loading={exporting}>
        Exportieren
      </Button>
      <Button variant="primary" size="sm" onClick={onCreateItem}>
        Neuer Gegenstand
      </Button>
    </div>
  </header>
);

export default ItemsPageHeader;
