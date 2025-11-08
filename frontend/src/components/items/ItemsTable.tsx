import React from 'react';
import Button from '../common/Button';
import type { Item } from '../../types/inventory';

/**
 * Props for the ItemsTable component.
 */
type Props = {
  /** The array of item objects to display in the table. */
  items: Item[];
  /** A key-value map of location IDs to location names for display. */
  locationMap: Record<number, string>;
  /** A key-value map of tag IDs to tag names for display. */
  tagMap: Record<number, string>;
  /** Callback function invoked when a user clicks to see an item's details. */
  onOpenDetails: (itemId: number) => void;
  /** If true, the table will display checkboxes for item selection. */
  selectionMode: boolean;
  /** Whether all items currently visible on the page are selected. Used for the header checkbox state. */
  areAllSelectedOnPage: boolean;
  /** Callback function to toggle the selection state of all items currently visible on the page. */
  onToggleSelectAllCurrentPage: () => void;
};

/**
 * Formats a string value as a German currency (EUR).
 * Returns '—' if the value is null, undefined, or not a valid number.
 *
 * @param {string | null | undefined} value The numeric string to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (value: string | null | undefined) => {
  if (!value) return '—';
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

/**
 * A component that displays a collection of inventory items in a data table.
 * It shows key details for each item in columns and provides an action button to view full details.
 * It also supports a `selectionMode` to show checkboxes for bulk actions.
 *
 * @todo The `selectionMode` prop enables a "select all" checkbox in the header, but the corresponding checkboxes for individual rows are missing. An `onSelectItem` prop and row-level checkboxes should be added to make selection functional.
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
