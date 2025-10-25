import React from 'react';
import Button from '../common/Button';

type Props = {
  /** The number of selected items. */
  selectedCount: number;
  /** Whether all items on the current page are selected. */
  areAllSelectedOnPage: boolean;
  /** Callback to toggle the selection of all items on the current page. */
  onToggleSelectAllCurrentPage: () => void;
  /** Callback to clear the selection. */
  onClearSelection: () => void;
  /** Callback to open the assign to list sheet. */
  onOpenAssignSheet: () => void;
};

/**
 * A toolbar that appears when items are selected, providing actions for the selection.
 *
 * @param {Props} props The props for the component.
 * @returns {JSX.Element | null} The rendered toolbar, or null if no items are selected.
 */
const SelectionToolbar: React.FC<Props> = ({
  selectedCount,
  areAllSelectedOnPage,
  onToggleSelectAllCurrentPage,
  onClearSelection,
  onOpenAssignSheet,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-30 w-full max-w-3xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{selectedCount} Gegenstände ausgewählt</p>
          <p className="text-xs text-slate-500">Wähle eine Liste oder ändere deine Auswahl.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onToggleSelectAllCurrentPage}>
            {areAllSelectedOnPage ? 'Auswahl dieser Seite entfernen' : 'Diese Seite auswählen'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            Auswahl löschen
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onOpenAssignSheet}>
            Zur Liste hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SelectionToolbar;
