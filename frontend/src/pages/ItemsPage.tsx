import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Select, { type MultiValue } from 'react-select';
import { QrScanner } from '@yudiel/react-qr-scanner';

import AddItemForm from '../components/AddItemForm';
import EditItemForm from '../components/EditItemForm';
import Button from '../components/common/Button';
import ItemDetailView from '../components/ItemDetailView';
import {
  deleteItem,
  fetchItem,
  fetchItemByAssetTag,
  fetchItemQrCode,
  fetchItems,
  fetchLocations,
  fetchTags,
} from '../api/inventory';
import type { Item, Location, Tag } from '../types/inventory';

type SortField = 'name' | 'quantity' | 'value' | 'purchase_date';

interface SelectOption {
  value: number;
  label: string;
}

const sortFieldLabel: Record<SortField, string> = {
  name: 'Name',
  quantity: 'Menge',
  value: 'Wert',
  purchase_date: 'Kaufdatum',
};

const PAGE_SIZE = 20;

const ItemsPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [qrLoadingId, setQrLoadingId] = useState<number | null>(null);
  const [qrModalItem, setQrModalItem] = useState<Item | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const ordering = `${sortDirection === 'desc' ? '-' : ''}${sortField}`;
        const [itemsResponse, tagResponse, locationResponse] = await Promise.all([
          fetchItems({
            query: debouncedSearch || undefined,
            page: currentPage,
            pageSize: PAGE_SIZE,
            tags: selectedTagIds,
            locations: selectedLocationIds,
            ordering,
          }),
          fetchTags(),
          fetchLocations(),
        ]);

        if (!isMounted) {
          return;
        }

        const computedTotalPages = Math.max(1, Math.ceil(itemsResponse.count / PAGE_SIZE));
        if (currentPage > computedTotalPages) {
          setCurrentPage(computedTotalPages);
        }
        setItems(itemsResponse.results);
        setTags(tagResponse);
        setLocations(locationResponse);
        setTotalItems(itemsResponse.count);
        setTotalPages(computedTotalPages);
      } catch (err) {
        console.error('Failed to load items', err);
        if (isMounted) {
          setError('Die Inventardaten konnten nicht aktualisiert werden. Prüfe deine Verbindung und versuche es noch einmal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [currentPage, debouncedSearch, refreshCounter, selectedLocationIds, selectedTagIds, sortDirection, sortField]);

  const loadDetailItem = useCallback(async (itemId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchItem(itemId);
      setDetailItem(response);
    } catch (err) {
      console.error('Failed to load item details', err);
      setDetailError('Die Detailansicht konnte nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showDetailModal || detailItemId == null) {
      return;
    }
    setDetailItem(null);
    void loadDetailItem(detailItemId);
  }, [detailItemId, loadDetailItem, showDetailModal]);

  const handleCloseScanner = useCallback(() => {
    setShowScannerModal(false);
    setScannerError(null);
    setIsProcessingScan(false);
  }, []);

  const handleOpenScanner = useCallback(() => {
    setScannerError(null);
    setIsProcessingScan(false);
    setShowScannerModal(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setShowDetailModal(false);
    setDetailItem(null);
    setDetailItemId(null);
    setDetailError(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (showAddModal) {
        setShowAddModal(false);
      }
      if (showEditModal) {
        setShowEditModal(false);
        setSelectedItem(null);
      }
      if (showDeleteModal) {
        setShowDeleteModal(false);
        setSelectedItem(null);
      }
      if (showScannerModal) {
        handleCloseScanner();
      }
      if (showDetailModal) {
        handleDetailClose();
      }
    };

    const hasModalOpen = showAddModal || showEditModal || showDeleteModal || showScannerModal || showDetailModal;
    if (hasModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleCloseScanner, handleDetailClose, showAddModal, showDeleteModal, showDetailModal, showEditModal, showScannerModal]);

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map((loc) => [loc.id, loc.name])), [locations]);

  const tagOptions = useMemo<SelectOption[]>(() => tags.map((tag) => ({ value: tag.id, label: tag.name })), [tags]);
  const locationOptions = useMemo<SelectOption[]>(
    () => locations.map((location) => ({ value: location.id, label: location.name })),
    [locations],
  );

  const selectedTagOptions = useMemo(
    () => tagOptions.filter((option) => selectedTagIds.includes(option.value)),
    [selectedTagIds, tagOptions],
  );

  const selectedLocationOptions = useMemo(
    () => locationOptions.filter((option) => selectedLocationIds.includes(option.value)),
    [locationOptions, selectedLocationIds],
  );

  const handleRefresh = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const handleTagFilterChange = (options: MultiValue<SelectOption>) => {
    const values = options.map((option) => option.value);
    setSelectedTagIds(values);
    setCurrentPage(1);
    setItems([]);
  };

  const handleLocationFilterChange = (options: MultiValue<SelectOption>) => {
    const values = options.map((option) => option.value);
    setSelectedLocationIds(values);
    setCurrentPage(1);
    setItems([]);
  };

  const handleSortChange = (field: SortField) => {
    setItems([]);
    setCurrentPage(1);
    setSortDirection((previous) => (sortField === field ? (previous === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const openEditModalWithItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  }, []);

  const handleScanResult = useCallback(
    async (decoded: string) => {
      if (!decoded || isProcessingScan) {
        return;
      }
      setScannerError(null);
      setIsProcessingScan(true);
      setShowScannerModal(false);
      try {
        const item = await fetchItemByAssetTag(decoded);
        openEditModalWithItem(item);
      } catch (err) {
        console.error('Failed to fetch item by asset tag', err);
        setError('Der gescannte QR-Code konnte keinem Gegenstand zugeordnet werden.');
      } finally {
        setIsProcessingScan(false);
      }
    },
    [isProcessingScan, openEditModalWithItem],
  );

  const closeQrModal = useCallback(() => {
    if (qrModalUrl) {
      URL.revokeObjectURL(qrModalUrl);
    }
    setQrModalUrl(null);
    setQrModalItem(null);
  }, [qrModalUrl]);

  const handleScanError = useCallback((err: unknown) => {
    console.error('QR scan failed', err);
    const message = err instanceof Error ? err.message : 'Der QR-Code konnte nicht gelesen werden. Bitte versuche es erneut.';
    setScannerError(message);
  }, []);

  const handleOpenQrCodeImage = useCallback(
    async (item: Item) => {
      setQrLoadingId(item.id);
      try {
        const blob = await fetchItemQrCode(item.id);
        const objectUrl = URL.createObjectURL(blob);
        if (qrModalUrl) {
          URL.revokeObjectURL(qrModalUrl);
        }
        setQrModalItem(item);
        setQrModalUrl(objectUrl);
      } catch (err) {
        console.error('Failed to open QR code image', err);
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setError('Deine Sitzung ist abgelaufen. Melde dich erneut an, um QR-Codes zu generieren.');
        } else {
          setError('Der QR-Code konnte nicht geladen werden. Bitte versuche es erneut.');
        }
      } finally {
        setQrLoadingId(null);
      }
    },
    [qrModalUrl],
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    setItems([]);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setItems([]);
  };

  const handleOpenDetail = (itemId: number) => {
    setDetailItemId(itemId);
    setShowDetailModal(true);
  };

  const handleDetailEdit = useCallback(() => {
    if (!detailItem) {
      return;
    }
    setShowDetailModal(false);
    setSelectedItem(detailItem);
    setShowEditModal(true);
  }, [detailItem]);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setRefreshCounter((prev) => prev + 1);
    setCurrentPage(1);
  };

  const handleAddCancel = () => {
    setShowAddModal(false);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedItem(null);
    setRefreshCounter((prev) => prev + 1);
    if (detailItemId != null) {
      void loadDetailItem(detailItemId);
    }
  };

  const handleEditCancel = () => {
    setShowEditModal(false);
    setSelectedItem(null);
  };

  const handleDeleteItem = (item: Item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) {
      return;
    }
    try {
      setDeleteLoading(true);
      await deleteItem(selectedItem.id);
      const wasLastItemOnPage = items.length === 1;
      const nextPage = wasLastItemOnPage && currentPage > 1 ? currentPage - 1 : currentPage;
      setShowDeleteModal(false);
      setSelectedItem(null);
      setCurrentPage(nextPage);
      setRefreshCounter((prev) => prev + 1);
      if (detailItemId === selectedItem.id) {
        handleDetailClose();
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Der Gegenstand konnte nicht gelöscht werden. Bitte versuche es erneut.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setSelectedItem(null);
  };

  const formatCurrency = (value: string | null) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return '—';
    }
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const hasActiveFilters = selectedTagIds.length > 0 || selectedLocationIds.length > 0;

  return (
    <div className="space-y-6 text-slate-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Inventarübersicht</h2>
          <p className="text-sm text-slate-600">
            Finde Gegenstände sekundenschnell über Namen, Beschreibungen oder deine Tags und Standorte.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="flex items-center gap-3">
            <Button type="button" variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              Neuen Gegenstand hinzufügen
            </Button>
            <Button type="button" variant="secondary" size="sm" loading={loading} onClick={handleRefresh}>
              Aktualisieren
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleOpenScanner}>
              QR-Code scannen
            </Button>
          </div>
          <input
            type="search"
            placeholder="Nach Gegenständen, Standorten oder Tags suchen …"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60 md:w-64"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</label>
            <Select
              isMulti
              options={tagOptions}
              value={selectedTagOptions}
              onChange={handleTagFilterChange}
              placeholder="Tags auswählen…"
              classNamePrefix="inventory-select"
              isClearable
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Standorte</label>
            <Select
              isMulti
              options={locationOptions}
              value={selectedLocationOptions}
              onChange={handleLocationFilterChange}
              placeholder="Standorte auswählen…"
              classNamePrefix="inventory-select"
              isClearable
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sortierung</label>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">{sortFieldLabel[sortField]}</span>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                {sortDirection === 'asc' ? 'aufsteigend' : 'absteigend'}
              </span>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-sm text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setSelectedTagIds([]);
                  setSelectedLocationIds([]);
                  setItems([]);
                  setCurrentPage(1);
                }}
              >
                Filter zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => handleSortChange('name')}
                >
                  <span>Name</span>
                  {getSortIndicator('name') && <span className="text-[10px]">{getSortIndicator('name')}</span>}
                </button>
              </th>
              <th className="px-4 py-3 text-left">Beschreibung</th>
              <th className="px-4 py-3 text-left">Standort</th>
              <th className="px-4 py-3 text-left">Tags</th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => handleSortChange('quantity')}
                >
                  <span>Menge</span>
                  {getSortIndicator('quantity') && <span className="text-[10px]">{getSortIndicator('quantity')}</span>}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => handleSortChange('value')}
                >
                  <span>Wert</span>
                  {getSortIndicator('value') && <span className="text-[10px]">{getSortIndicator('value')}</span>}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => handleSortChange('purchase_date')}
                >
                  <span>Kaufdatum</span>
                  {getSortIndicator('purchase_date') && (
                    <span className="text-[10px]">{getSortIndicator('purchase_date')}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-center">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Lade Items …
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Keine Einträge gefunden. Erstelle den ersten Gegenstand oder passe deine Suchkriterien an.
                </td>
              </tr>
            )}

            {!loading &&
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <button
                      type="button"
                      className="text-left text-blue-600 hover:text-blue-800"
                      onClick={() => handleOpenDetail(item.id)}
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.description ? item.description.slice(0, 80) : 'â€”'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{locationMap[item.location ?? 0] ?? 'N/A'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {item.tags.length > 0 ? (
                        item.tags.map((tagId) => (
                          <span
                            key={tagId}
                            className="inline-flex items-center rounded-full bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700"
                          >
                            {tagMap[tagId] ?? `Tag ${tagId}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Keine Tags</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(item.value)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatDate(item.purchase_date)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModalWithItem(item)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Löschen
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-emerald-600 hover:text-emerald-800"
                        loading={qrLoadingId === item.id}
                        onClick={() => void handleOpenQrCodeImage(item)}
                      >
                        QR-Code
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm text-slate-600">
            Zeige Seite {currentPage} von {totalPages} ({totalItems} Gegenstände)
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Zurück
            </Button>
            <span className="px-3 py-1 text-sm text-slate-600">{currentPage}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={handleAddCancel} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-heading"
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-6">
              <h3 id="add-item-heading" className="text-xl font-semibold text-slate-900">
                Neuen Gegenstand hinzufügen
              </h3>
              <p className="text-sm text-slate-600">
                Erstelle einen neuen Inventargegenstand und weise ihm optionale Tags und Standorte zu.
              </p>
            </div>
            <AddItemForm
              locations={locations}
              tags={tags}
              onSuccess={handleAddSuccess}
              onCancel={handleAddCancel}
            />
          </div>
        </div>
      )}

      {showEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={handleEditCancel} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-item-heading"
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-6">
              <h3 id="edit-item-heading" className="text-xl font-semibold text-slate-900">
                Gegenstand bearbeiten
              </h3>
              <p className="text-sm text-slate-600">Bearbeite die Informationen für "{selectedItem.name}".</p>
            </div>
            <EditItemForm
              item={selectedItem}
              locations={locations}
              tags={tags}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
            />
          </div>
        </div>
      )}

      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={handleDeleteCancel} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-heading"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-6">
              <h3 id="delete-item-heading" className="text-xl font-semibold text-slate-900">
                Gegenstand löschen
              </h3>
              <p className="text-sm text-slate-600">
                Bist du sicher, dass du "{selectedItem.name}" löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleDeleteCancel}
                disabled={deleteLoading}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleDeleteConfirm}
                loading={deleteLoading}
                className="flex-1"
              >
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}

      {qrModalItem && qrModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={closeQrModal} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-heading"
            className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 id="qr-modal-heading" className="text-xl font-semibold text-slate-900">
                  QR-Code anzeigen
                </h3>
                <p className="text-sm text-slate-600">QR-Code für "{qrModalItem.name}"</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeQrModal}>
                Schließen
              </Button>
            </div>
            <div className="flex justify-center rounded-2xl bg-slate-100 p-6">
              <img
                src={qrModalUrl}
                alt={`QR-Code für ${qrModalItem.name}`}
                className="max-h-[60vh] w-full max-w-xs rounded-xl bg-white p-4 shadow-lg"
              />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-slate-500">Scanne diesen Code, um den Gegenstand sofort aufzurufen.</div>
              <a
                href={qrModalUrl}
                download={`item-${qrModalItem.id}-qr.png`}
                className="inline-flex items-center rounded-lg border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:border-brand-300 hover:bg-brand-50"
              >
                QR-Code herunterladen
              </a>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && (
        <ItemDetailView
          item={detailItem}
          loading={detailLoading}
          error={detailError}
          onClose={handleDetailClose}
          onEdit={handleDetailEdit}
          onRetry={detailItemId != null ? () => void loadDetailItem(detailItemId) : undefined}
          tagMap={tagMap}
          locationMap={locationMap}
        />
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={handleCloseScanner} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-heading"
            className="relative max-h-[90vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
          >
            <div className="mb-6">
              <h3 id="qr-scanner-heading" className="text-xl font-semibold text-slate-900">
                QR-Code scannen
              </h3>
              <p className="text-sm text-slate-600">
                Richte die Kamera auf den QR-Code eines Gegenstands, um ihn sofort zu öffnen.
              </p>
            </div>
            {scannerError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {scannerError}
              </div>
            )}
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
              <QrScanner
                constraints={{ facingMode: 'environment' }}
                containerStyle={{ width: '100%', height: '100%' }}
                onDecode={(result: string | null) => {
                  if (typeof result === 'string') {
                    void handleScanResult(result);
                  }
                }}
                onError={(maybeError?: Error) => {
                  if (maybeError) {
                    handleScanError(maybeError);
                  }
                }}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="secondary" onClick={handleCloseScanner}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
