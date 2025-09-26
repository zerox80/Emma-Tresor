import React, { useEffect, useState } from 'react';

import Button from '../components/common/Button';
import { fetchItems, fetchLists, createList } from '../api/inventory';
import type { Item, ItemList } from '../types/inventory';

interface ListWithItems extends ItemList {
  resolvedItems: Item[];
}

const ListsPage: React.FC = () => {
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const [listsResponse, itemsResponse] = await Promise.all([
          fetchLists(),
          fetchItems({ pageSize: 200 }),
        ]);
        if (!isMounted) {
          return;
        }
        const itemMap = new Map<number, Item>(itemsResponse.results.map((item) => [item.id, item]));
        setLists(
          listsResponse.map((list) => ({
            ...list,
            resolvedItems: list.items
              .map((itemId) => itemMap.get(itemId))
              .filter((entry): entry is Item => Boolean(entry)),
          })),
        );
      } catch (err) {
        console.error('Failed to load lists', err);
        if (isMounted) {
          setError('Die Listen konnten nicht synchronisiert werden. Prüfe deine Verbindung und versuche es in Kürze erneut.');
        }
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
      const [listsResponse, itemsResponse] = await Promise.all([
        fetchLists(),
        fetchItems({ pageSize: 200 }),
      ]);
      const itemMap = new Map<number, Item>(itemsResponse.results.map((item) => [item.id, item]));
      setLists(
        listsResponse.map((list) => ({
          ...list,
          resolvedItems: list.items
            .map((itemId) => itemMap.get(itemId))
            .filter((entry): entry is Item => Boolean(entry)),
        })),
      );
      setError(null);
    } catch (err) {
      console.error('Failed to refresh lists', err);
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
      setLists(prev => [...prev, listWithItems]);
      setShowCreateModal(false);
      setNewListName('');
    } catch (err) {
      console.error('Failed to create list:', err);
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
              <span className="text-xs font-semibold text-slate-500">{list.items.length} Items</span>
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
    </div>
  );
};

export default ListsPage;
