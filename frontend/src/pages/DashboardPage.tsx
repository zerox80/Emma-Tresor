import React, { useEffect, useState } from 'react';

import { fetchAllItems, fetchLists, fetchLocations, fetchTags } from '../api/inventory';
import type { Item, ItemList, Location, Tag } from '../types/inventory';

interface DashboardStats {
  items: Item[];
  lists: ItemList[];
  tags: Tag[];
  locations: Location[];
}

/**
 * The main dashboard page, displaying a summary of the user's inventory.
 *
 * @returns {JSX.Element} The rendered dashboard page.
 */
const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const [items, lists, tags, locations] = await Promise.all([
          fetchAllItems(),
          fetchLists(),
          fetchTags(),
          fetchLocations(),
        ]);
        if (isMounted) {
          setStats({ items, lists, tags, locations });
        }
      } catch (err) {
        if (isMounted) {
          setError('Das Dashboard konnte nicht aktualisiert werden. Bitte überprüfe deine Verbindung und versuche es erneut.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const itemsTotalValue =
    stats?.items.reduce((total, item) => {
      if (!item.value) {
        return total;
      }
      const numeric = Number.parseFloat(item.value);
      if (Number.isNaN(numeric) || !Number.isFinite(numeric) || numeric < 0) {
        return total;
      }
      return total + numeric;
    }, 0) ?? 0;

  return (
    <div className="space-y-8 text-slate-700">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Gesamtbestand</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '…' : stats?.items.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Alle erfassten Gegenstände deiner privaten EmmaTresor-Sammlung.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Listen</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '…' : stats?.lists.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Smarte Sammlungen für Projekte, Umzüge und Übergaben.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Geschätzter Wert</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '…' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(itemsTotalValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Basierend auf deinen hinterlegten Kaufpreisen – jederzeit anpassbar.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Struktur</h3>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {loading
              ? '…'
              : `${stats?.tags.length ?? 0} Tags · ${stats?.locations.length ?? 0} Orte`}
          </p>
          <p className="mt-1 text-xs text-slate-500">Verleihe deinem Inventar Kontext – blitzschnell filterbar.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Zuletzt hinzugefügt</h2>
            <span className="text-xs text-slate-500">Automatisch aktualisiert</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {loading && <li className="text-slate-400">Lade Items …</li>}
            {!loading && stats?.items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                <span className="font-medium text-slate-900">{item.name}</span>
                <span className="text-xs text-slate-500">
                  {item.quantity}× ·{' '}
                  {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('de-DE') : 'Datum unbekannt'}
                </span>
              </li>
            ))}
            {!loading && stats?.items.length === 0 && (
              <li className="text-slate-400">Noch keine Gegenstände angelegt – starte mit deinem ersten Eintrag in EmmaTresor.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Aktive Listen</h2>
            <span className="text-xs text-slate-500">Drag & Drop folgt bald</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {loading && <li className="text-slate-400">Lade Listen …</li>}
            {!loading && stats?.lists.slice(0, 5).map((list) => (
              <li key={list.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                <span className="font-medium text-slate-900">{list.name}</span>
                <span className="text-xs text-slate-500">{list.items.length} Items</span>
              </li>
            ))}
            {!loading && stats?.lists.length === 0 && (
              <li className="text-slate-400">Noch keine Listen erstellt – strukturiere deine Gegenstände nach Themen oder Räumen.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
