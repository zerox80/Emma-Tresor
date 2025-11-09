import React from 'react';
import Button from '../common/Button';
import type { Item } from '../../types/inventory';

type Props = {
  
  items: Item[];
  
  locationMap: Record<number, string>;
  
  tagMap: Record<number, string>;
  
  onOpenDetails: (itemId: number) => void;
};

const formatCurrency = (value: string | null | undefined) => {
  if (!value) return '—';
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

const ItemsGrid: React.FC<Props> = ({ items, locationMap, tagMap, onOpenDetails }) => {
  return (
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
                {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('de-DE') : 'Kaufdatum unbekannt'}
              </p>
              {item.wodis_inventory_number && (
                <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  WODIS • {item.wodis_inventory_number}
                </div>
              )}
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
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDetails(item.id)}>
              Details & QR-Code
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
};

export default ItemsGrid;
