import React from 'react';
import Button from './common/Button';
import type { Item } from '../types/inventory';

interface ItemDetailViewProps {
  item: Item | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onRetry?: () => void;
  tagMap: Record<number, string>;
  locationMap: Record<number, string>;
}

const ItemDetailView: React.FC<ItemDetailViewProps> = ({
  item,
  loading,
  error,
  onClose,
  onEdit,
  onRetry,
  tagMap,
  locationMap,
}) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-heading"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 id="item-detail-heading" className="text-2xl font-semibold text-slate-900">
              {loading ? 'Lade Details...' : item?.name || 'Gegenstand Details'}
            </h3>
            <p className="text-sm text-slate-600">
              Vollständige Ansicht des Inventargegenstands
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600 mx-auto"></div>
              <p className="text-slate-600">Lade Gegenstand-Details...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="mb-4 text-red-700">{error}</p>
            {onRetry && (
              <Button type="button" variant="secondary" onClick={onRetry}>
                Erneut versuchen
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        {!loading && !error && item && (
          <div className="space-y-8">
            {/* Images Section */}
            {item.images && item.images.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Bilder</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {item.images.map((image, index) => (
                    <div key={index} className="overflow-hidden rounded-lg bg-white shadow-sm">
                      <img
                        src={typeof image === 'string' ? image : image.image}
                        alt={`${item.name} - Bild ${index + 1}`}
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-500">Keine Bilder verfügbar</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Basic Information */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Grundinformationen</h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Name</dt>
                    <dd className="mt-1 text-sm text-slate-900">{item.name}</dd>
                  </div>
                  {item.description && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Beschreibung</dt>
                      <dd className="mt-1 text-sm text-slate-900">{item.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Menge</dt>
                    <dd className="mt-1 text-sm text-slate-900">{item.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Wert</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</dd>
                  </div>
                  {item.purchase_date && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Kaufdatum</dt>
                      <dd className="mt-1 text-sm text-slate-900">{formatDate(item.purchase_date)}</dd>
                    </div>
                  )}
                  {item.asset_tag && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Asset-Tag</dt>
                      <dd className="mt-1 text-sm font-mono text-slate-900">{item.asset_tag}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Location and Tags */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Zuordnung</h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Standort</dt>
                    <dd className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {locationMap[item.location ?? 0] ?? 'Kein Standort'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Tags</dt>
                    <dd className="mt-1">
                      {item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tagId) => (
                            <span
                              key={tagId}
                              className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800"
                            >
                              {tagMap[tagId] ?? `Tag ${tagId}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Keine Tags zugewiesen</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Audit Log Section (Placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h4 className="mb-4 text-lg font-semibold text-slate-900">Änderungshistorie</h4>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-900">Dieses Feature wird bald verfügbar sein</p>
                <p className="mt-1 text-sm text-slate-500">
                  Hier werden zukünftig alle Änderungen an diesem Gegenstand protokolliert.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!loading && !error && item && (
          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Schließen
            </Button>
            <Button type="button" variant="primary" onClick={onEdit}>
              Bearbeiten
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDetailView;
