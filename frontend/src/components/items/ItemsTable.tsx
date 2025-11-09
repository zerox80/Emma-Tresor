// Items Table Component
// ====================
// This component displays inventory items in a table format with sortable columns,
// selection capabilities, and responsive design. Each row shows comprehensive item data.

import React from 'react';
import Button from '../common/Button';
import type { Item } from '../../types/inventory';

/**
 * Props interface for ItemsTable component.
 * Defines the data, state, and callbacks needed to render the item table.
 */
type Props = {
  /** Array of item objects to display in the table */
  items: Item[];

  /** Mapping of location IDs to location names for display */
  locationMap: Record<number, string>;

  /** Mapping of tag IDs to tag names for display */
  tagMap: Record<number, string>;

  /** Callback function triggered when user wants to view item details */
  onOpenDetails: (itemId: number) => void;

  /** Whether selection mode is active (shows checkboxes for bulk actions) */
  selectionMode: boolean;

  /** Whether all items on the current page are selected */
  areAllSelectedOnPage: boolean;

  /** Function to toggle selection of all items on current page */
  onToggleSelectAllCurrentPage: () => void;
};

/**
 * Format a monetary value as German Euro currency.
 * Reused utility function from ItemsGrid for consistency.
 *
 * @param {string | null | undefined} value - The monetary value as string or null/undefined
 * @returns {string} Formatted currency string (e.g., "1.234,56 €") or "—" for invalid values
 */
const formatCurrency = (value: string | null | undefined) => {
  if (!value) return '—';
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
};

/**
 * Items Table Component Function.
 *
 * Renders a comprehensive data table showing inventory items with columns for
 * name, location, tags, quantity, value, purchase date, and actions. Includes
 * selection mode for bulk operations and responsive design.
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenDetails(item.id)}
                >
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
