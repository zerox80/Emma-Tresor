import React, { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';

import Button from '../components/common/Button';
import ManageListItemsSheet, { type ManageableItem } from '../components/ManageListItemsSheet';
import { fetchAllItems, fetchLists, createList, updateListItems, deleteList } from '../api/inventory';
import type { Item, ItemList } from '../types/inventory';

interface ListWithItems extends ItemList {
  resolvedItems: Item[];
}

/**
 * The page for viewing and managing item lists.
 *
 * @returns {JSX.Element} The rendered lists page.
 */
const ListsPage: React.FC = () => {
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [manageListTarget, setManageListTarget] = useState<ListWithItems | null>(null);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const [listsResponse, items] = await Promise.all([
          fetchLists(),
          fetchAllItems(),
        ]);
        if (!isMounted) {
          return;
        }
        setAllItems(items);
        const itemMap = new Map<number, Item>(items.map((item) => [item.id, item]));
        const mappedLists: ListWithItems[] = listsResponse.map((list): ListWithItems => ({
          ...list,
          resolvedItems: list.items
            .map((itemId) => itemMap.get(itemId))
            .filter((entry): entry is Item => Boolean(entry)),
        }));
        setLists(mappedLists);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError('Die Listen konnten nicht synchronisiert werden. Prüfe deine Verbindung und versuche es in Kürze erneut.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadLists();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listsResponse, items] = await Promise.all([
        fetchLists(),
        fetchAllItems(),
      ]);
      setAllItems(items);
      const itemMap = new Map<number, Item>(items.map((item) => [item.id, item]));
      const mappedLists: ListWithItems[] = listsResponse.map((list): ListWithItems => ({
        ...list,
        resolvedItems: list.items
          .map((itemId) => itemMap.get(itemId))
          .filter((entry): entry is Item => Boolean(entry)),
      }));
      setLists(mappedLists);
      setError(null);
    } catch (err) {
      setError('Aktualisieren fehlgeschlagen. Bitte versuche es gleich erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setCreateError('Listenname ist erforderlich.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const newList = await createList(newListName.trim());
      const listWithItems: ListWithItems = {
        ...newList,
        resolvedItems: [],
      };
      setLists((prev: ListWithItems[]) => [...prev, listWithItems]);
      setShowCreateModal(false);
      setNewListName('');
    } catch (err) {
      setCreateError('Liste konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setNewListName('');
    setCreateError(null);
  };

  const itemMap = useMemo(() => new Map<number, Item>(allItems.map((item) => [item.id, item])), [allItems]);

  const manageableItems = useMemo<ManageableItem[]>(() => {
    const assignmentCountMap = new Map<number, number>();
    lists.forEach((list) => {
      list.items.forEach((itemId) => {
        assignmentCountMap.set(itemId, (assignmentCountMap.get(itemId) ?? 0) + 1);
      });
    });

    return allItems.map((item) => ({
      ...item,
      assignmentCount: assignmentCountMap.get(item.id) ?? 0,
    }));
  }, [allItems, lists]);

  const handleOpenManageItems = (listId: number) => {
    const target = lists.find((list) => list.id === listId);
    if (!target) {
      return;
    }
    setManageListTarget(target);
    setManageError(null);
  };

  const handleCloseManageItems = () => {
    if (manageSaving) {
      return;
    }
    setManageListTarget(null);
    setManageError(null);
  };

  const handleSaveManageItems = async (itemIds: number[]) => {
    if (!manageListTarget) {
      return;
    }

    setManageSaving(true);
    setManageError(null);
    try {
      const updated = await updateListItems(manageListTarget.id, itemIds);
      const resolvedItems = updated.items
        .map((itemId) => itemMap.get(itemId))
        .filter((entry): entry is Item => Boolean(entry));

      setLists((prev) =>
        prev.map((list: ListWithItems) =>
          list.id === updated.id
            ? {
                ...list,
                items: updated.items,
                resolvedItems,
              }
            : list,
        ),
      );

      setManageListTarget(null);
      setManageError(null);
    } catch (err) {
      const axiosError = err as AxiosError;
      const fallback = axiosError.response?.data && typeof axiosError.response.data === 'object'
        ? (axiosError.response.data as { detail?: string }).detail
        : null;
      setManageError(fallback ?? 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setManageSaving(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (deletingListId !== null) {
      return;
    }

    const target = lists.find((list) => list.id === listId);
    if (!target) {
      return;
    }

    let confirmed = true;
    if (typeof window !== 'undefined') {
      confirmed = window.confirm(`Liste "${target.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`);
    }
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingListId(listId);
    try {
      await deleteList(listId);
      setLists((prev) => prev.filter((list) => list.id !== listId));
      if (manageListTarget?.id === listId) {
        setManageListTarget(null);
        setManageError(null);
      }
    } catch (err) {
      const axiosError = err as AxiosError;
      const fallback = axiosError.response?.data && typeof axiosError.response.data === 'object'
        ? (axiosError.response.data as { detail?: string }).detail
        : null;
      setDeleteError(fallback ?? 'Liste konnte nicht gelöscht werden. Bitte versuche es erneut.');
    } finally {
      setDeletingListId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-700">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Benutzerdefinierte Listen</h2>
          <p className="text-sm text-slate-600">
            Struktur für jedes Vorhaben: Plane Umzüge, Projekte oder Reparaturen mit wenigen Klicks. Drag & Drop folgt bald.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            Neue Liste erstellen
          </Button>
          <Button type="button" variant="secondary" size="sm" loading={loading} onClick={handleRefresh}>
            Aktualisieren
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{deleteError}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && lists.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">Lade Listen …</div>
        )}

        {!loading && lists.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Noch keine Listen erstellt. Starte mit deiner ersten Sammlung und gruppiere Gegenstände nach Räumen oder Projekten.
          </div>
        )}

        {lists.map((list) => (
          <article key={list.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{list.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{list.items.length} Items</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenManageItems(list.id)}>
                  Items bearbeiten
                </Button>
                <button
                  type="button"
                  onClick={() => handleDeleteList(list.id)}
                  className="rounded-full p-2 text-red-500 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Liste ${list.name} löschen`}
                  disabled={deletingListId === list.id}
                >
                  {deletingListId === list.id ? (
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-.447-2.236A2 2 0 0014.618 3H9.382a2 2 0 00-1.965 1.764L7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </header>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {list.resolvedItems.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.quantity}×</span>
                </li>
              ))}
              {list.resolvedItems.length === 0 && (
                <li className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Noch keine Items zugeordnet – füge später beliebige Gegenstände hinzu.
                </li>
              )}
            </ul>
          </article>
        ))}
      </div>

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={handleCancelCreate} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-list-heading"
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-6">
              <h3 id="create-list-heading" className="text-xl font-semibold text-slate-900">
                Neue Liste erstellen
              </h3>
              <p className="text-sm text-slate-600">
                Erstelle eine neue Liste um deine Gegenstände zu organisieren.
              </p>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="list-name" className="block text-sm font-medium text-slate-700">
                  Listenname
                </label>
                <input
                  id="list-name"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="z.B. Umzug Küche, Werkzeuge, ..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                  disabled={isCreating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleCreateList();
                    } else if (e.key === 'Escape') {
                      handleCancelCreate();
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCancelCreate}
                disabled={isCreating}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleCreateList}
                loading={isCreating}
                className="flex-1"
              >
                Liste erstellen
              </Button>
            </div>
          </div>
        </div>
      )}

      <ManageListItemsSheet
        open={Boolean(manageListTarget)}
        onClose={handleCloseManageItems}
        listName={manageListTarget?.name ?? ''}
        items={manageableItems}
        initialSelectedIds={manageListTarget?.items ?? []}
        saving={manageSaving}
        error={manageError}
        onSave={handleSaveManageItems}
      />
    </div>
  );
};

export default ListsPage;
