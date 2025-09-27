import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import Button from '../components/common/Button';
import AddItemDialog from '../components/AddItemDialog';
import ItemDetailView from '../components/ItemDetailView';
import {
  createLocation,
  createTag,
  fetchItem,
  fetchItems,
  fetchLocations,
  fetchTags,
} from '../api/inventory';
import type { Item, Location, PaginatedResponse, Tag } from '../types/inventory';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const PAGE_SIZE = 20;

type ViewMode = 'grid' | 'table';

const formatCurrency = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

const ItemsPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Item> | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [ordering, setOrdering] = useState<string>('-purchase_date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const [fetchedTags, fetchedLocations] = await Promise.all([fetchTags(), fetchLocations()]);
        if (!active) {
          return;
        }
        const sortedTags = [...fetchedTags].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
        const sortedLocations = [...fetchedLocations].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
        setTags(sortedTags);
        setLocations(sortedLocations);
      } catch (error) {
        console.error('Failed to load tag/location metadata', error);
        if (active) {
          setMetaError('Tags und Standorte konnten nicht geladen werden. Bitte versuche es erneut.');
        }
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    };

    void loadMeta();

    return () => {
      active = false;
    };
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setItemsError(null);
    try {
      const response = await fetchItems({
        query: debouncedSearchTerm || undefined,
        page,
        pageSize: PAGE_SIZE,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      });
      setItems(response.results);
      setPagination(response);
    } catch (error) {
      console.error('Failed to load items', error);
      setItemsError('Deine Gegenstände konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.');
    } finally {
      setLoadingItems(false);
    }
  }, [debouncedSearchTerm, ordering, page, selectedLocationIds, selectedTagIds]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  useEffect(() => {
    void loadItems();
  }, [loadItems, page]);

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleToggleLocation = (locationId: number) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId],
    );
  };

  const handleClearFilters = () => {
    setSelectedTagIds([]);
    setSelectedLocationIds([]);
    setOrdering('-purchase_date');
    setSearchTerm('');
  };

  const handleCreateTag = useCallback(async (name: string) => {
    const newTag = await createTag(name);
    setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newTag;
  }, []);

  const handleCreateLocation = useCallback(async (name: string) => {
    const newLocation = await createLocation(name);
    setLocations((prev) => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    return newLocation;
  }, []);

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleItemCreated = async (item: Item) => {
    setDialogOpen(false);
    setInfoMessage(`„${item.name}“ wurde erfolgreich angelegt.`);
    await loadItems();
  };

  const loadItemDetails = useCallback(async (itemId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const itemData = await fetchItem(itemId);
      setDetailItem(itemData);
    } catch (error) {
      console.error('Failed to load item details', error);
      setDetailError('Details konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleOpenItemDetails = useCallback(
    (itemId: number) => {
      setDetailItemId(itemId);
      const cachedItem = items.find((currentItem) => currentItem.id === itemId) ?? null;
      setDetailItem(cachedItem);
      void loadItemDetails(itemId);
    },
    [items, loadItemDetails],
  );

  const handleCloseItemDetails = useCallback(() => {
    setDetailItemId(null);
    setDetailItem(null);
    setDetailError(null);
  }, []);

  const handleRetryItemDetails = useCallback(() => {
    if (detailItemId != null) {
      void loadItemDetails(detailItemId);
    }
  }, [detailItemId, loadItemDetails]);

  const totalItemsCount = pagination?.count ?? items.length;
  const totalQuantity = useMemo(
    () => items.reduce((sum, current) => sum + current.quantity, 0),
    [items],
  );
  const totalValue = useMemo(
    () =>
      items.reduce((sum, current) => {
        if (!current.value) {
          return sum;
        }
        const numeric = Number.parseFloat(current.value);
        return Number.isFinite(numeric) && numeric > 0 ? sum + numeric : sum;
      }, 0),
    [items],
  );

  const isFiltered =
    debouncedSearchTerm.length > 0 || selectedTagIds.length > 0 || selectedLocationIds.length > 0 || ordering !== '-purchase_date';

  return (
    <div className="relative space-y-8">
      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex items-start justify-between gap-3">
            <span>{infoMessage}</span>
            <button
              type="button"
              className="text-emerald-600 transition hover:text-emerald-800"
              onClick={() => setInfoMessage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gesamtanzahl</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loadingItems ? '…' : totalItemsCount}</p>
          <p className="mt-1 text-xs text-slate-500">Alle Gegenstände, die deinen Filtern entsprechen.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summe Stückzahl</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loadingItems ? '…' : totalQuantity}</p>
          <p className="mt-1 text-xs text-slate-500">Wie viele Einheiten aktuell erfasst sind.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geschätzter Wert</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loadingItems ? '…' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Basierend auf deinen Angaben zum Kaufpreis.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schnellaktionen</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
              Gegenstand hinzufügen
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void loadItems()} loading={loadingItems}>
              Aktualisieren
            </Button>
          </div>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Inventar filtern</h2>
            <p className="text-sm text-slate-600">
              Nutze Suche, Tags und Standorte, um blitzschnell den richtigen Gegenstand zu finden.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                className={clsx(
                  'rounded-md px-3 py-1 transition',
                  viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'hover:text-brand-600',
                )}
                onClick={() => setViewMode('grid')}
              >
                Karten
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-md px-3 py-1 transition',
                  viewMode === 'table' ? 'bg-white text-brand-600 shadow-sm' : 'hover:text-brand-600',
                )}
                onClick={() => setViewMode('table')}
              >
                Tabelle
              </button>
            </div>
            {isFiltered && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <label htmlFor="items-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suche
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60">
              <span className="mr-2 text-slate-400">🔍</span>
              <input
                id="items-search"
                type="search"
                placeholder="Name, Beschreibung, Standort ..."
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {metaLoading && <span className="text-xs text-slate-400">Lade Tags …</span>}
              {!metaLoading && tags.length === 0 && (
                <span className="text-xs text-slate-400">Noch keine Tags vorhanden.</span>
              )}
              {!metaLoading &&
                tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={clsx(
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                      selectedTagIds.includes(tag.id)
                        ? 'bg-brand-500 text-white shadow'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Standorte</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {metaLoading && <span className="text-xs text-slate-400">Lade Standorte …</span>}
              {!metaLoading && locations.length === 0 && (
                <span className="text-xs text-slate-400">Noch keine Standorte vorhanden.</span>
              )}
              {!metaLoading &&
                locations.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    className={clsx(
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                      selectedLocationIds.includes(location.id)
                        ? 'bg-blue-500 text-white shadow'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                    onClick={() => handleToggleLocation(location.id)}
                  >
                    {location.name}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sortierung</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: 'Neueste Kaufdaten', value: '-purchase_date' },
              { label: 'Älteste Kaufdaten', value: 'purchase_date' },
              { label: 'Name A-Z', value: 'name' },
              { label: 'Name Z-A', value: '-name' },
              { label: 'Höchste Menge', value: '-quantity' },
              { label: 'Höchster Wert', value: '-value' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  ordering === option.value
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                onClick={() => setOrdering(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Gegenstände</h3>
            <p className="text-sm text-slate-500">
              {loadingItems
                ? 'Lade Gegenstände …'
                : `${pagination?.count ?? items.length} Ergebnisse gesamt${isFiltered ? ' (gefiltert)' : ''}.`}
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
            Neuer Gegenstand
          </Button>
        </header>

        {itemsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <div className="flex items-start justify-between gap-3">
              <span>{itemsError}</span>
              <Button variant="ghost" size="sm" onClick={() => void loadItems()}>
                Erneut laden
              </Button>
            </div>
          </div>
        )}

        {loadingItems && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        )}

        {!loadingItems && items.length === 0 && !itemsError && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              📦
            </div>
            <h4 className="mt-4 text-xl font-semibold text-slate-900">Noch keine Gegenstände erfasst</h4>
            <p className="mt-2 text-sm text-slate-500">
              Lege deinen ersten Gegenstand an und starte deine Inventarliste. Alles ist in wenigen Schritten erledigt.
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="primary" size="md" onClick={() => setDialogOpen(true)}>
                Jetzt starten
              </Button>
            </div>
          </div>
        )}

        {!loadingItems && items.length > 0 && viewMode === 'grid' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">{item.name}</h4>
                    <p className="text-xs text-slate-500">
                      {item.purchase_date
                        ? new Date(item.purchase_date).toLocaleDateString('de-DE')
                        : 'Kaufdatum unbekannt'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {item.quantity}×
                  </span>
                </header>

                {item.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600">{item.description}</p>
                )}

                <dl className="mt-4 grid gap-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <dt>Standort</dt>
                    <dd className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {item.location ? locationMap[item.location] ?? 'Unbekannt' : 'Kein Standort'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Wert</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(item.value)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.length > 0 ? (
                    item.tags.map((tagId) => (
                      <span
                        key={tagId}
                        className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700"
                      >
                        {tagMap[tagId] ?? `Tag ${tagId}`}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Keine Tags</span>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={() => handleOpenItemDetails(item.id)}>
                    Details & QR-Code
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loadingItems && items.length > 0 && viewMode === 'table' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Standort
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Tags
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Menge
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Wert
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Kaufdatum
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      {item.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.location ? locationMap[item.location] ?? 'Unbekannt' : 'Kein Standort'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tagId) => (
                            <span
                              key={tagId}
                              className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700"
                            >
                              {tagMap[tagId] ?? `Tag ${tagId}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Keine Tags</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {item.purchase_date
                        ? new Date(item.purchase_date).toLocaleDateString('de-DE')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Button type="button" variant="secondary" size="sm" onClick={() => handleOpenItemDetails(item.id)}>
                        Anzeigen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (pagination.next || pagination.previous) && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span>
              Seite {page} · {pagination.count} Ergebnisse insgesamt
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!pagination.previous || page === 1 || loadingItems}
              >
                Zurück
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!pagination.next || loadingItems}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </section>

      <button
        type="button"
        className="fixed bottom-8 right-8 z-40 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300"
        onClick={() => setDialogOpen(true)}
      >
        <span className="text-lg">＋</span>
        <span>Gegenstand hinzufügen</span>
      </button>

      <AddItemDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onCreated={handleItemCreated}
        tags={tags}
        locations={locations}
        onCreateTag={handleCreateTag}
        onCreateLocation={handleCreateLocation}
      />

      {detailItemId !== null && (
        <ItemDetailView
          item={detailItem}
          loading={detailLoading}
          error={detailError}
          onClose={handleCloseItemDetails}
          onEdit={() => handleCloseItemDetails()}
          onRetry={handleRetryItemDetails}
          tagMap={tagMap}
          locationMap={locationMap}
        />
      )}
    </div>
  );
};

export default ItemsPage;
