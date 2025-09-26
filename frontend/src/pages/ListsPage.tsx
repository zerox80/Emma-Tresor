import React, { useEffect, useState } from 'react';

import Button from '../components/common/Button';
import { fetchItems, fetchLists } from '../api/inventory';
import type { Item, ItemList } from '../types/inventory';

interface ListWithItems extends ItemList {
  resolvedItems: Item[];
}

const ListsPage: React.FC = () => {
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 text-slate-700">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Benutzerdefinierte Listen</h2>
          <p className="text-sm text-slate-600">
            Struktur für jedes Vorhaben: Plane Umzüge, Projekte oder Reparaturen mit wenigen Klicks. Drag & Drop folgt bald.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" loading={loading} onClick={handleRefresh}>
          Aktualisieren
        </Button>
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
    </div>
  );
};

export default ListsPage;
