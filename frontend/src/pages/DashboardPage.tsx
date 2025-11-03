import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';

import Button from '../components/common/Button';
import ListItemsPreviewSheet from '../components/ListItemsPreviewSheet';
import ManageListItemsSheet, { type ManageableItem } from '../components/ManageListItemsSheet';
import { fetchAllItems, fetchLists, fetchLocations, fetchTags, updateListItems } from '../api/inventory';
import type { Item, ItemList, Location, Tag } from '../types/inventory';

interface DashboardStats {
  items: Item[];
  lists: ItemList[];
  tags: Tag[];
  locations: Location[];
}

interface ListWithDetail extends ItemList {
  resolvedItems: Item[];
  isExpanded?: boolean;
}

const MAX_LISTS_DISPLAYED = 4;

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<number>>(new Set<number>());
  const [listsWithDetail, setListsWithDetail] = useState<ListWithDetail[]>([]);
  const [manageTarget, setManageTarget] = useState<ListWithDetail | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ListWithDetail | null>(null);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, lists, tags, locations] = await Promise.all([
        fetchAllItems(),
        fetchLists(),
        fetchTags(),
        fetchLocations(),
      ]);
      setStats({ items, lists, tags, locations });
    } catch (err) {
      const axiosError = err as AxiosError;
      const detail = axiosError.response?.data && typeof axiosError.response.data === 'object'
        ? (axiosError.response.data as { detail?: string }).detail
        : null;
      setError(detail ?? 'Das Dashboard konnte nicht aktualisiert werden. Bitte überprüfe deine Verbindung und versuche es erneut.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!stats) {
      setListsWithDetail([]);
      return;
    }
    const itemMap = new Map<number, Item>(stats.items.map((item: Item) => [item.id, item]));
    setListsWithDetail(stats.lists.map((list) => ({
      ...list,
      resolvedItems: list.items
        .map((itemId) => itemMap.get(itemId))
        .filter((entry): entry is Item => Boolean(entry))
        .sort((a: Item, b: Item) => a.name.localeCompare(b.name)),
      isExpanded: expandedLists.has(list.id),
    })));
  }, [stats, expandedLists]);

  const locationLookup = useMemo(() => {
    if (!stats) {
      return new Map<number, string>();
    }
    return new Map<number, string>(stats.locations.map((location: Location) => [location.id, location.name]));
  }, [stats]);

  const itemsTotalValue = useMemo(() => {
    if (!stats) {
      return 0;
    }
    return stats.items.reduce((total: number, item: Item) => {
      if (!item.value) {
        return total;
      }
      const numeric = Number.parseFloat(item.value);
      if (Number.isNaN(numeric) || !Number.isFinite(numeric) || numeric < 0) {
        return total;
      }
      return total + numeric;
    }, 0);
  }, [stats]);

  const manageableItems = useMemo<ManageableItem[]>(() => {
    if (!stats) {
      return [];
    }
    const assignmentCount = new Map<number, number>();
    stats.lists.forEach((list) => {
      list.items.forEach((itemId) => {
        assignmentCount.set(itemId, (assignmentCount.get(itemId) ?? 0) + 1);
      });
    });
    return stats.items.map((item) => ({
      ...item,
      assignmentCount: assignmentCount.get(item.id) ?? 0,
    }));
  }, [stats]);

  const handleToggleList = useCallback((listId: number) => {
    setExpandedLists((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, []);

  const handleOpenManage = useCallback((listId: number) => {
    const target = listsWithDetail.find((list: ListWithDetail) => list.id === listId) ?? null;
    setManageTarget(target);
    setManageError(null);
  }, [listsWithDetail]);

  const handleCloseManage = useCallback(() => {
    if (manageSaving) {
      return;
    }
    setManageTarget(null);
    setManageError(null);
  }, [manageSaving]);

  const handleOpenPreview = useCallback((listId: number) => {
    const target = listsWithDetail.find((list: ListWithDetail) => list.id === listId) ?? null;
    setPreviewTarget(target);
  }, [listsWithDetail]);

  const handleClosePreview = useCallback(() => {
    setPreviewTarget(null);
  }, []);

  const handleNavigateToList = useCallback(() => {
    if (!previewTarget) {
      return;
    }
    window.location.assign(`/lists#list-${previewTarget.id}`);
  }, [previewTarget]);

  const handleSaveManage = useCallback(async (itemIds: number[]) => {
    if (!manageTarget) {
      return;
    }
    setManageSaving(true);
    setManageError(null);
    try {
      const updated = await updateListItems(manageTarget.id, itemIds);
      setStats((prev: DashboardStats | null) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          lists: prev.lists.map((list) => (list.id === updated.id ? updated : list)),
        };
      });
      setManageTarget(null);
    } catch (err) {
      const axiosError = err as AxiosError;
      const detail = axiosError.response?.data && typeof axiosError.response.data === 'object'
        ? (axiosError.response.data as { detail?: string }).detail
        : null;
      setManageError(detail ?? 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setManageSaving(false);
    }
  }, [manageTarget]);

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
            <span className="text-xs text-slate-500">Direkt hier bearbeiten</span>
          </div>

          {loading && <p className="mt-4 text-sm text-slate-400">Lade Listen …</p>}

          {!loading && listsWithDetail.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">Noch keine Listen erstellt – starte mit deiner ersten Sammlung.</p>
          )}

          {!loading && listsWithDetail.length > 0 && (
            <ul className="mt-4 space-y-4">
              {listsWithDetail.slice(0, MAX_LISTS_DISPLAYED).map((list) => {
                const hasItems = list.resolvedItems.length > 0;
                const isExpanded = expandedLists.has(list.id);
                return (
                  <li key={list.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-t-xl border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => handleToggleList(list.id)}
                    >
                      <span className="text-sm font-semibold text-slate-900">
                        {list.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{list.items.length} Items</span>
                        <span className="text-lg leading-none text-slate-400">{isExpanded ? '−' : '+'}</span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-4 px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs uppercase tracking-wide text-brand-500">Listen-Items</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenPreview(list.id)}>
                              Liste ansehen
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenManage(list.id)}>
                              Items verwalten
                            </Button>
                          </div>
                        </div>

                        {!hasItems && (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            Noch keine Gegenstände in dieser Liste. Füge welche hinzu, um direkt loszulegen.
                          </div>
                        )}

                        {hasItems && (
                          <ul className="space-y-2 text-sm text-slate-600">
                            {list.resolvedItems.slice(0, 4).map((item: Item) => {
                              const locationName = item.location ? locationLookup.get(item.location) ?? 'Ort unbekannt' : 'Ort unbekannt';
                              return (
                                <li
                                  key={item.id}
                                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                                >
                                  <span className="font-medium text-slate-900">{item.name}</span>
                                  <span className="text-xs text-slate-400">
                                    {item.quantity}× · {locationName}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {hasItems && list.resolvedItems.length > 4 && (
                          <p className="text-xs text-slate-400">
                            … und {list.resolvedItems.length - 4} weitere Gegenstände
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}

              {listsWithDetail.length > MAX_LISTS_DISPLAYED && (
                <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {listsWithDetail.length - MAX_LISTS_DISPLAYED} weitere Listen sind vorhanden.
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <ManageListItemsSheet
        open={Boolean(manageTarget)}
        onClose={handleCloseManage}
        listName={manageTarget?.name ?? ''}
        items={manageableItems}
        initialSelectedIds={manageTarget?.items ?? []}
        saving={manageSaving}
        error={manageError}
        onSave={handleSaveManage}
      />

      <ListItemsPreviewSheet
        open={Boolean(previewTarget)}
        onClose={handleClosePreview}
        listName={previewTarget?.name ?? ''}
        items={previewTarget?.resolvedItems ?? []}
        getLocationName={(locationId: number | null) => (locationId ? locationLookup.get(locationId) ?? 'Ort unbekannt' : 'Ort unbekannt')}
        onNavigateToList={previewTarget ? handleNavigateToList : undefined}
      />
    </div>
  );
};

export default DashboardPage;
