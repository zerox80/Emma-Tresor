import React from 'react';

import Button from './common/Button';
import type { Item } from '../types/inventory';

interface ListItemsPreviewSheetProps {
  open: boolean;
  onClose: () => void;
  listName: string;
  items: Item[];
  getLocationName: (locationId: number | null) => string;
  onNavigateToList?: () => void;
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
  onNavigateToList,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-8 py-6">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Noch keine Gegenstände in dieser Liste. Verwende „Items bearbeiten“, um neue Einträge hinzuzufügen.
            </div>
          )}

          {items.length > 0 && (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-500 line-clamp-3">{item.description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">{item.quantity}× vorhanden</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">{formatDate(item.purchase_date)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">{getLocationName(item.location ?? null)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white px-8 py-6">
          <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>Mehr Aktionen findest du auf der Detailseite der Liste.</span>
            <div className="flex flex-wrap items-center gap-2">
              {onNavigateToList && (
                <Button type="button" variant="secondary" size="sm" onClick={onNavigateToList}>
                  Details & QR-Code öffnen
                </Button>
              )}
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
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
