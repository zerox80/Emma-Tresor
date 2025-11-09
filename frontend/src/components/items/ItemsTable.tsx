// Items Table Component
// ====================
// This component displays inventory items in a table format with sortable columns,
// selection capabilities, and responsive design. Each row shows comprehensive item data.

import React from 'react';                                       // Import React library for JSX
import Button from '../common/Button';                           // Import reusable Button component
import type { Item } from '../../types/inventory';              // Import Item type definition

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
  if (!value) return '—';                                          // Return em dash for null/undefined/empty values
  const numeric = Number.parseFloat(value);                        // Convert string to number
  if (!Number.isFinite(numeric) || numeric < 0) return '—';        // Return em dash for invalid or negative numbers

  // Format using German locale (comma decimal separator, dot thousands separator)
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
  items,                                                         // Array of items to display
  locationMap,                                                   // Location ID to name mapping
  tagMap,                                                        // Tag ID to name mapping
  onOpenDetails,                                                 // Details modal callback
  selectionMode,                                                 // Whether to show selection checkboxes
  areAllSelectedOnPage,                                          // Whether all items are selected
  onToggleSelectAllCurrentPage,                                  // Toggle all selection callback
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      {/* Table element with responsive width and styling */}
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {/* Table header with column titles */}
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {/* Selection checkbox column - only shown in selection mode */}
            {selectionMode && (
              <th scope="col" className="px-4 py-3 text-left">
                <input
                  type="checkbox"                                       // Checkbox for selecting all items
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={areAllSelectedOnPage}                       // Reflect current selection state
                  onChange={onToggleSelectAllCurrentPage}              // Toggle selection on change
                  aria-label="Alle Gegenstände auf dieser Seite auswählen" // Accessibility label (German)
                />
              </th>
            )}

            {/* Column headers */}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Name</th>
            {/* German: "Location" */}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Standort</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Tags</th>
            {/* German: "Quantity" */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Menge</th>
            {/* German: "Value" */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Wert</th>
            {/* German: "Purchase Date" */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Kaufdatum</th>
            {/* German: "Actions" */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Aktionen</th>
          </tr>
        </thead>

        {/* Table body with item rows */}
        <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
          {/* Map over items to create a table row for each */}
          {items.map((item) => (
            <tr key={item.id} className="transition hover:bg-slate-50">
              {/* Name column with item details */}
              <td className="px-4 py-3">
                {/* Primary item name */}
                <div className="font-semibold text-slate-900">{item.name}</div>

                {/* WODIS inventory number - conditional rendering */}
                {item.wodis_inventory_number && (
                  <p className="mt-1 text-xs font-semibold text-indigo-600">
                    WODIS • {item.wodis_inventory_number}
                  </p>
                )}

                {/* Item description - truncated to 1 line */}
                {item.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{item.description}</p>
                  // line-clamp-1: Limit to 1 line with ellipsis
                )}
              </td>

              {/* Location column */}
              <td className="px-4 py-3 text-sm">
                {item.location
                  ? locationMap[item.location] ?? 'Unbekannt'          // Show location name or "Unknown"
                  : 'Kein Standort'                                      // German: "No location"
                }
              </td>

              {/* Tags column */}
              <td className="px-4 py-3 text-sm">
                {item.tags.length > 0 ? (
                  // Render tag pills if tags exist
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tagId) => (
                      <span
                        key={tagId}                                      // Unique key for React reconciliation
                        className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700"
                      >
                        {tagMap[tagId] ?? `Tag ${tagId}`}                // Show tag name or fallback
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Keine Tags</span>
                  // German: "No tags"
                )}
              </td>

              {/* Quantity column - right aligned */}
              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{item.quantity}</td>

              {/* Value column - right aligned, formatted as currency */}
              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</td>

              {/* Purchase date column - right aligned */}
              <td className="px-4 py-3 text-right text-sm">
                {item.purchase_date
                  ? new Date(item.purchase_date).toLocaleDateString('de-DE') // German date format
                  : '—'                                                      // Em dash for unknown dates
                }
              </td>

              {/* Actions column - right aligned */}
              <td className="px-4 py-3 text-right text-sm">
                <Button
                  type="button"                                       // Prevent form submission
                  variant="secondary"                                   // Gray button style
                  size="sm"                                           // Small button size
                  onClick={() => onOpenDetails(item.id)}              // Open details modal
                >
                  {/* German: "Show" */}
                  Anzeigen
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>                                                          // Close table container
  );                                                               // Close return statement
};

export default ItemsTable;                                         // Export as default component
