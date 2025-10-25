import React from 'react';
import Button from '../common/Button';
import type { Item } from '../../types/inventory';

type Props = {
  /** The list of items to display. */
  items: Item[];
  /** A map of location IDs to location names. */
  locationMap: Record<number, string>;
  /** A map of tag IDs to tag names. */
  tagMap: Record<number, string>;
  /** Callback to open the details view for an item. */
  onOpenDetails: (itemId: number) => void;
  /** Whether the table is in selection mode. */
  selectionMode: boolean;
  /** Whether all items on the current page are selected. */
  areAllSelectedOnPage: boolean;
  /** Callback to toggle the selection of all items on the current page. */
  onToggleSelectAllCurrentPage: () => void;
};

/**
 * Formats a currency value.
 *
 * @param {string | null | undefined} value The value to format.
 * @returns {string} The formatted currency value.
 */
const formatCurrency = (value: string | null | undefined) => {
  if (!value) return '—';
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

/**
 * A component that displays a table of items.
 *
 * @param {Props} props The props for the component.
 * @returns {JSX.Element} The rendered table of items.
 */
const ItemsTable: React.FC<Props> = ({
  items,
  locationMap,
  tagMap,
  onOpenDetails,
  selectionMode,
  areAllSelectedOnPage,
  onToggleSelectAllCurrentPage,
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {selectionMode && (
              <th scope="col" className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={areAllSelectedOnPage}
                  onChange={onToggleSelectAllCurrentPage}
                  aria-label="Alle Gegenstände auf dieser Seite auswählen"
                />
              </th>
            )}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Name</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Standort</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Tags</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Menge</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Wert</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Kaufdatum</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
          {items.map((item) => (
            <tr key={item.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900">{item.name}</div>
                {item.wodis_inventory_number && (
                  <p className="mt-1 text-xs font-semibold text-indigo-600">
                    WODIS • {item.wodis_inventory_number}
                  </p>
                )}
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
              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</td>
              <td className="px-4 py-3 text-right text-sm">
                {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('de-DE') : '—'}
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDetails(item.id)}>
                  Anzeigen
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemsTable;
