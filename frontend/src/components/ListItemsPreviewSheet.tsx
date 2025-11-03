import React from 'react';

import Button from './common/Button';
import type { Item } from '../types/inventory';

interface ListItemsPreviewSheetProps {
  open: boolean;
  onClose: () => void;
  listName: string;
  items: Item[];
  getLocationName: (locationId: number | null) => string;
  onOpenItemDetails: (item: Item) => void;
  onExportList: () => void;
  exporting: boolean;
  exportError: string | null;
}

const formatDate = (date: string | null): string => {
  if (!date) {
    return 'Datum unbekannt';
  }

  try {
    return new Date(date).toLocaleDateString('de-DE');
  } catch (err) {
    return 'Datum unbekannt';
  }
};

const ListItemsPreviewSheet: React.FC<ListItemsPreviewSheetProps> = ({
  open,
  onClose,
  listName,
  items,
  getLocationName,
  onOpenItemDetails,
  onExportList,
  exporting,
  exportError,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-5 sm:py-8 lg:px-8 lg:py-12">
      <div
        className="absolute inset-0 bg-slate-900/45"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_36px_70px_-30px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/10 lg:max-w-3xl"
        style={{ maxHeight: 'min(92vh, 760px)' }}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:gap-4 sm:px-8 sm:py-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Liste ansehen</p>
            <h2 className="text-2xl font-semibold text-slate-900">{listName}</h2>
            <p className="text-sm text-slate-500">
              {items.length === 1 ? '1 Gegenstand' : `${items.length} Gegenstände`} in dieser Sammlung
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Noch keine Gegenstände in dieser Liste. Verwende „Items bearbeiten“, um neue Einträge hinzuzufügen.
            </div>
          )}

          {items.length > 0 && (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-500 line-clamp-3">{item.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-3 py-1 font-medium sm:w-auto">
                        {item.quantity}× vorhanden
                      </span>
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-3 py-1 font-medium sm:w-auto">
                        {formatDate(item.purchase_date)}
                      </span>
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-3 py-1 font-medium sm:w-auto">
                        {getLocationName(item.location ?? null)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenItemDetails(item)}
                      className="w-full sm:w-auto"
                    >
                      Details &amp; QR-Code anzeigen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {exportError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {exportError}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={exporting}
                onClick={onExportList}
                className="w-full sm:w-auto"
              >
                CSV exportieren
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onClose} className="w-full sm:w-auto">
                Schließen
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default ListItemsPreviewSheet;
