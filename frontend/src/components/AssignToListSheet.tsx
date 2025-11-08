import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import Button from './common/Button';
import type { ItemList } from '../types/inventory';

/**
 * Props for the AssignToListSheet component.
 */
interface AssignToListSheetProps {
  /**
   * Whether the sheet is open.
   */
  open: boolean;
  /**
   * Callback to close the sheet.
   */
  onClose: () => void;
  /**
   * The lists to display.
   */
  lists: ItemList[];
  /**
   * Whether the lists are loading.
   */
  loading: boolean;
  /**
   * An error message if loading failed.
   */
  error: string | null;
  /**
   * Callback to reload the lists.
   */
  onReload: () => void;
  /**
   * Callback to assign items to a list.
   * @param listId The ID of the list to assign items to.
   * @returns A promise that resolves when the assignment is complete.
   */
  onAssign: (listId: number) => Promise<void>;
  /**
   * Whether the assignment is in progress.
   */
  assignLoading: boolean;
  /**
   * An error message if assignment failed.
   */
  assignError: string | null;
  /**
   * The number of items selected for assignment.
   */
  selectedCount: number;
  /**
   * Callback to create a new list.
   * @param name The name of the new list.
   * @returns A promise that resolves with the new list.
   */
  onCreateList: (name: string) => Promise<ItemList>;
}

/**
 * A sheet component that slides in from the side to allow users to assign selected items to an existing or new list.
 * It includes functionality for searching lists, creating new lists, and handling loading and error states.
 *
 * @param {AssignToListSheetProps} props The props for the component.
 * @returns {JSX.Element | null} The rendered component, or null if the sheet is not open.
 */
const AssignToListSheet: React.FC<AssignToListSheetProps> = ({
  open,
  onClose,
  lists,
  loading,
  error,
  onReload,
  onAssign,
  assignLoading,
  assignError,
  selectedCount,
  onCreateList,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setInternalError(null);
      setCreateMode(false);
      setNewListName('');
      setCreateError(null);
    } else {
      setSelectedListId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (lists.length > 0 && selectedListId == null) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, open, selectedListId]);

  useEffect(() => {
    if (assignError) {
      setInternalError(assignError);
    }
  }, [assignError]);

  const filteredLists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return lists;
    }
    return lists.filter((list) => list.name.toLowerCase().includes(term));
  }, [lists, searchTerm]);

  const handleAssign = async () => {
    if (selectedListId == null) {
      setInternalError('Bitte wähle eine Liste aus.');
      return;
    }

    setInternalError(null);
    try {
      await onAssign(selectedListId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Zuweisung fehlgeschlagen. Bitte versuche es erneut.';
      setInternalError(message);
    }
  };

  const handleCreateList = async () => {
    const trimmed = newListName.trim();
    if (trimmed.length === 0) {
      setCreateError('Listenname ist erforderlich.');
      return;
    }

    setCreateError(null);
    setCreateLoading(true);
    try {
      const newList = await onCreateList(trimmed);
      setCreateMode(false);
      setNewListName('');
      setSelectedListId(newList.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Liste konnte nicht erstellt werden.';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden="true"
        onClick={() => {
          if (!assignLoading && !createLoading) {
            onClose();
          }
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Zu Liste hinzufügen</h2>
            <p className="text-sm text-slate-500">{selectedCount} Gegenstände werden hinzugefügt.</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={() => {
              if (!assignLoading && !createLoading) {
                onClose();
              }
            }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <div className="flex items-start justify-between gap-3">
                <span>{error}</span>
                <Button type="button" variant="ghost" size="sm" onClick={onReload}>
                  Erneut laden
                </Button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="assign-search" className="block text-sm font-medium text-slate-700">
              Listen durchsuchen
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60">
              <span className="mr-2 text-slate-400">🔍</span>
              <input
                id="assign-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Listenname"
                className="w-full border-none bg-transparent outline-none"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Deine Listen</h3>
              {!createMode && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateMode(true)}>
                  Neue Liste
                </Button>
              )}
            </div>

            {createMode && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="assign-new-list" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Listenname
                </label>
                <input
                  id="assign-new-list"
                  type="text"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateList();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      if (!createLoading) {
                        setCreateMode(false);
                        setNewListName('');
                        setCreateError(null);
                      }
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                  disabled={createLoading}
                  placeholder="z. B. Umzug Küche"
                />
                {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!createLoading) {
                        setCreateMode(false);
                        setNewListName('');
                        setCreateError(null);
                      }
                    }}
                    disabled={createLoading}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => void handleCreateList()}
                    loading={createLoading}
                  >
                    Liste erstellen
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {loading && lists.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Lade Listen …
                </div>
              )}

              {!loading && filteredLists.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Keine Listen gefunden. Erstelle eine neue Liste, um zu starten.
                </div>
              )}

              {filteredLists.map((list) => {
                const checked = selectedListId === list.id;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={clsx(
                      'w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-200/60',
                      checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold',
                          checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 bg-white text-slate-400',
                        )}
                        aria-hidden="true"
                      >
                        {checked ? '✓' : ''}
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="font-medium text-slate-900">{list.name}</span>
                        <span className="text-xs text-slate-500">{list.items.length} Items</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {internalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{internalError}</div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => void handleAssign()}
            loading={assignLoading}
            disabled={assignLoading || loading || filteredLists.length === 0}
          >
            Zur Liste hinzufügen
          </Button>
        </div>
      </aside>
    </div>
  );
};

export default AssignToListSheet;
