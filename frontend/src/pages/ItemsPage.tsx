import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { QrScanner } from '@yudiel/react-qr-scanner';

import AddItemForm from '../components/AddItemForm';
import EditItemForm from '../components/EditItemForm';
import Button from '../components/common/Button';
import { fetchItems, fetchLocations, fetchTags, deleteItem, fetchItemByAssetTag } from '../api/inventory';
import type { Item, Location, Tag } from '../types/inventory';

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

  const PAGE_SIZE = 20;

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedSearch(trimmed);
    }, 400);

    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [itemsResponse, tagResponse, locationResponse] = await Promise.all([
          fetchItems({ query: debouncedSearch || undefined, page: currentPage, pageSize: PAGE_SIZE }),
          fetchTags(),
          fetchLocations(),
        ]);
        if (isMounted) {
          const computedTotalPages = Math.max(1, Math.ceil(itemsResponse.count / PAGE_SIZE));
          if (currentPage > computedTotalPages) {
            setCurrentPage(computedTotalPages);
          }
          setItems(itemsResponse.results);
          setTags(tagResponse);
          setLocations(locationResponse);
          setTotalItems(itemsResponse.count);
          setTotalPages(computedTotalPages);
        }
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
  }, [debouncedSearch, refreshCounter, currentPage]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
      }
    };

    const hasModalOpen = showAddModal || showEditModal || showDeleteModal || showScannerModal;
    if (hasModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleCloseScanner, showAddModal, showDeleteModal, showEditModal, showScannerModal]);

  const tagMap = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map((loc) => [loc.id, loc.name])), [locations]);

  const handleRefresh = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const openEditModalWithItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  }, []);

  const handleScanResult = useCallback(
    async (decoded: string) => {
      if (!decoded || isProcessingScan) return;
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

  const handleScanError = useCallback((err: unknown) => {
    console.error('QR scan failed', err);
    const message = err instanceof Error ? err.message : 'Der QR-Code konnte nicht gelesen werden. Bitte versuche es erneut.';
    setScannerError(message);
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    setItems([]); // Clear items to show loading state
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setItems([]); // Clear items to show loading state
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setRefreshCounter((prev) => prev + 1);
    setCurrentPage(1); // Reset to first page after adding new item
  };

  const handleAddCancel = () => {
    setShowAddModal(false);
  };

  const handleEditItem = (item: Item) => {
    openEditModalWithItem(item);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedItem(null);
    setRefreshCounter((prev) => prev + 1);
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
    if (!selectedItem) return;

    try {
      setDeleteLoading(true);
      await deleteItem(selectedItem.id);
      const wasLastItemOnPage = items.length === 1;
      const nextPage = wasLastItemOnPage && currentPage > 1 ? currentPage - 1 : currentPage;
      setShowDeleteModal(false);
      setSelectedItem(null);
      setCurrentPage(nextPage);
      setRefreshCounter((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to delete item:', error);
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

  return (
    <div className="space-y-6 text-slate-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Inventarübersicht</h2>
          <p className="text-sm text-slate-600">
            Finde Gegenstände sekundenschnell über Namen, Beschreibungen oder deine Tags und Standorte.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            Neuen Gegenstand hinzufügen
          </Button>
          <input
            type="search"
            placeholder="Nach Gegenständen, Standorten oder Tags suchen …"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60 md:w-64"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <Button type="button" variant="secondary" size="sm" loading={loading} onClick={handleRefresh}>
            Aktualisieren
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleOpenScanner}>
            QR-Code scannen
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Beschreibung</th>
              <th className="px-4 py-3 text-left">Standort</th>
              <th className="px-4 py-3 text-left">Tags</th>
              <th className="px-4 py-3 text-right">Menge</th>
              <th className="px-4 py-3 text-right">Wert</th>
              <th className="px-4 py-3 text-center">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Lade Items …
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Keine Einträge gefunden. Erstelle den ersten Gegenstand oder passe deine Suchkriterien an.
                </td>
              </tr>
            )}

            {!loading &&
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.description ? item.description.slice(0, 80) : '—'}
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
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditItem(item)}
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
                        onClick={() => window.open(`/api/items/${item.id}/generate_qr_code/`, '_blank', 'noopener')}
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

      {/* Pagination */}
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
            <span className="px-3 py-1 text-sm text-slate-600">
              {currentPage}
            </span>
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

      {/* Add Item Modal */}
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
            <AddItemForm locations={locations} tags={tags} onSuccess={handleAddSuccess} onCancel={handleAddCancel} />
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
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

      {/* Delete Item Modal */}
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

      {/* QR Scanner Modal */}
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
                onError={(error?: Error) => {
                  if (error) {
                    handleScanError(error);
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
