import React, { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import clsx from 'clsx';

import Button from './common/Button';
import type { Item } from '../types/inventory';

/**
 * Extends the base `Item` type with information about its assignments.
 * @property {number} assignmentCount - The number of lists this item is currently assigned to.
 */
export interface ManageableItem extends Item {
  assignmentCount: number;
}

/**
 * Defines the available filter modes for the item list.
 * - `all`: Show all items.
 * - `unassigned`: Show only items not assigned to any list.
 * - `inList`: Show only items currently selected for this list.
 */
type FilterMode = 'all' | 'unassigned' | 'inList';

/**
 * An array of filter options for display in the UI.
 */
const filterOptions: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'unassigned', label: 'Nicht zugewiesen' },
  { value: 'inList', label: 'In dieser Liste' },
];

/**
 * Props for the ManageListItemsSheet component.
 */
export interface ManageListItemsSheetProps {
  /** Whether the sheet is currently open and visible. */
  open: boolean;
  /** Callback function to close the sheet. */
  onClose: () => void;
  /** The name of the list being managed. */
  listName: string;
  /** The complete list of all manageable items in the inventory. */
  items: ManageableItem[];
  /** An array of IDs for items that are initially selected (i.e., already in the list). */
  initialSelectedIds: number[];
  /** A boolean indicating if the save operation is in progress. */
  saving: boolean;
  /** An error message string if a save operation fails, otherwise null. */
  error: string | null;
  /**
   * Callback function to save the changes.
   * @param {number[]} itemIds - An array of the final selected item IDs.
   * @returns {Promise<void>} A promise that resolves when the save is complete.
   */
  onSave: (itemIds: number[]) => Promise<void>;
}

/**
 * A full-screen modal sheet for managing the items within a specific list.
 * It allows users to search, filter, and select/deselect items to be included in the list,
 * tracks changes (additions/removals), and handles saving those changes.
 *
 * @param {ManageListItemsSheetProps} props The props for the component.
 * @returns {JSX.Element | null} The rendered component, or null if the sheet is not `open`.
 */
const ManageListItemsSheet: React.FC<ManageListItemsSheetProps> = ({
  open,
  onClose,
  listName,
  items,
  initialSelectedIds,
  saving,
  error,
  onSave,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<number>>(new Set<number>(initialSelectedIds));
  const [localError, setLocalError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const initialSelectedSet = useMemo(() => new Set<number>(initialSelectedIds), [initialSelectedIds]);

  // Effect to reset internal state when the sheet is opened.
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setLocalSelectedIds(new Set<number>(initialSelectedIds));
      setLocalError(null);
      setFilterMode('all');
    }
  }, [open, initialSelectedIds]);

  // Effect to sync external error prop to local state.
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  /**
   * Memoized array of items filtered by the current search term and filter mode.
   * @type {ManageableItem[]}
   */
  const filteredItems = useMemo<ManageableItem[]>(() => {
    const term = searchTerm.trim().toLowerCase();
    const base: ManageableItem[] = term.length === 0
      ? items
      : items.filter((item: ManageableItem) => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(term));

    return base.filter((item: ManageableItem) => {
      if (filterMode === 'unassigned') {
        return item.assignmentCount === 0;
      }
      if (filterMode === 'inList') {
        return localSelectedIds.has(item.id);
      }
      return true;
    });
  }, [items, searchTerm, filterMode, localSelectedIds]);

  const selectedCount = localSelectedIds.size;
  const filteredCount = filteredItems.length;
  const allFilteredSelected = filteredCount > 0 && filteredItems.every((item) => localSelectedIds.has(item.id));

  /**
   * Memoized counts for each filter category.
   * @type {Record<FilterMode, number>}
   */
  const filterCounts = useMemo<Record<FilterMode, number>>(() => {
    const unassignedCount = items.reduce((count: number, item: ManageableItem) => (item.assignmentCount === 0 ? count + 1 : count), 0);
    return {
      all: items.length,
      unassigned: unassignedCount,
      inList: selectedCount,
    };
  }, [items, selectedCount]);

  /**
   * Memoized summary of changes made (items added or removed) compared to the initial state.
   * @type {{addedCount: number, removedCount: number, hasChanges: boolean}}
   */
  const changeSummary = useMemo(() => {
    let addedCount = 0;
    localSelectedIds.forEach((id: number) => {
      if (!initialSelectedSet.has(id)) {
        addedCount += 1;
      }
    });

    let removedCount = 0;
    initialSelectedSet.forEach((id: number) => {
      if (!localSelectedIds.has(id)) {
        removedCount += 1;
      }
    });

    return {
      addedCount,
      removedCount,
      hasChanges: addedCount > 0 || removedCount > 0,
    };
  }, [initialSelectedSet, localSelectedIds]);

  const { addedCount, removedCount, hasChanges } = changeSummary;

  /**
   * Toggles the selection state of a single item.
   * @param {number} itemId The ID of the item to toggle.
   */
  const handleToggleItem = (itemId: number) => {
    setLocalSelectedIds((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  /**
   * Toggles the selection state for all items currently visible in the filtered list.
   */
  const handleToggleFiltered = () => {
    if (filteredCount === 0) {
      return;
    }

    setLocalSelectedIds((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (allFilteredSelected) {
        filteredItems.forEach((item: ManageableItem) => next.delete(item.id));
      } else {
        filteredItems.forEach((item: ManageableItem) => next.add(item.id));
      }
      return next;
    });
  };

  /**
   * Clears the entire selection, deselecting all items.
   */
  const handleClearSelection = () => {
    setLocalSelectedIds(new Set<number>());
  };

  /**
   * Handles changes to the search input field.
   * @param {ChangeEvent<HTMLInputElement>} event The input change event.
   */
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  /**
   * Handles the save action, calling the onSave prop with the final list of selected item IDs.
   */
  const handleSave = async () => {
    if (!hasChanges) {
      return;
    }

    setLocalError(null);
    try {
      await onSave(Array.from(localSelectedIds));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Änderungen konnten nicht gespeichert werden.';
      setLocalError(message);
    }
  };

  const summaryParts: string[] = [];
  if (addedCount > 0) {
    summaryParts.push(`${addedCount} hinzugefügt`);
  }
  if (removedCount > 0) {
    summaryParts.push(`${removedCount} entfernt`);
  }

  const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Keine Änderungen';
  
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-5 sm:py-8 lg:px-8 lg:py-12">
      <div
        className="absolute inset-0 bg-slate-900/45"
        aria-hidden="true"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_36px_70px_-30px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/10"
        style={{ maxHeight: 'min(92vh, 800px)' }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-8 sm:py-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Liste bearbeiten</p>
            <h2 className="text-2xl font-semibold text-slate-900">{listName}</h2>
            <p className="text-sm text-slate-500">
              {selectedCount} von {items.length} Gegenständen ausgewählt
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={() => {
              if (!saving) {
                onClose();
              }
            }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="space-y-5 border-b border-slate-200 px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full lg:max-w-lg">
                <label htmlFor="manage-items-search" className="block text-sm font-medium text-slate-700">
                  Gegenstände durchsuchen
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60">
                  <span className="text-slate-400">🔍</span>
                  <input
                    id="manage-items-search"
                    type="search"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Name oder Beschreibung"
                    className="w-full border-none bg-transparent outline-none"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {filterOptions.map((option) => {
                  const isActive = filterMode === option.value;
                  const count = filterCounts[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilterMode(option.value)}
                      className={clsx(
                        'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        isActive
                          ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-600',
                      )}
                      disabled={saving}
                    >
                      <span>{option.label}</span>
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleFiltered}
                disabled={filteredCount === 0 || saving}
              >
                {allFilteredSelected ? 'Gefilterte abwählen' : 'Gefilterte auswählen'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedCount === 0 || saving}
              >
                Auswahl leeren
              </Button>
              <span className="text-slate-400">{filteredCount} Ergebnisse</span>
            </div>

            {localError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                {localError}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
              {items.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Noch keine Gegenstände erfasst. Lege zunächst Einträge im Inventar an.
                </div>
              )}

              {items.length > 0 && filteredCount === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Keine Treffer für „{searchTerm}“.
                </div>
              )}

              {filteredCount > 0 && (
                <ul className="grid gap-3 md:grid-cols-2">
                  {filteredItems.map((item: ManageableItem) => {
                    const checked = localSelectedIds.has(item.id);
                    const isUnassigned = item.assignmentCount === 0;
                    return (
                      <li
                        key={item.id}
                        className={clsx(
                          'rounded-2xl border p-4 shadow-sm transition',
                          checked
                            ? 'border-brand-300 bg-brand-50/80 ring-1 ring-brand-200'
                            : 'border-slate-200 bg-white hover:border-brand-200 hover:shadow-md',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex flex-1 cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              checked={checked}
                              onChange={() => handleToggleItem(item.id)}
                              disabled={saving}
                            />
                            <span className="flex flex-1 flex-col gap-1">
                              <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                              {item.description && (
                                <span className="text-xs text-slate-500 line-clamp-2">{item.description}</span>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{item.quantity}× vorhanden</span>
                                <span
                                  className={clsx(
                                    'rounded-full px-2 py-0.5 font-semibold',
                                    isUnassigned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
                                  )}
                                >
                                  {isUnassigned ? 'Nicht zugewiesen' : `${item.assignmentCount} Listen`}
                                </span>
                              </div>
                            </span>
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              {summaryText}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={saving || !hasChanges}
                className="w-full sm:w-auto"
              >
                Änderungen speichern
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default ManageListItemsSheet;
