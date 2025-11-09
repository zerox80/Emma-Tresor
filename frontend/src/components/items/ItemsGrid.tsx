// Items Grid Component
// ===================
// This component displays inventory items in a responsive card grid layout.
// Each card shows item details, quantity, location, tags, and a details button.

import React from 'react';                                       // Import React library for JSX
import Button from '../common/Button';                           // Import reusable Button component
import type { Item } from '../../types/inventory';              // Import Item type definition

/**
 * Props interface for ItemsGrid component.
 * Defines the data and callbacks needed to render the item cards.
 */
type Props = {
  /** Array of item objects to display in the grid */
  items: Item[];

  /** Mapping of location IDs to location names for display */
  locationMap: Record<number, string>;

  /** Mapping of tag IDs to tag names for display */
  tagMap: Record<number, string>;

  /** Callback function triggered when user wants to view item details */
  onOpenDetails: (itemId: number) => void;
};

/**
 * Format a monetary value as German Euro currency.
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
 * Items Grid Component Function.
 *
 * Renders a responsive grid of item cards. Each card displays comprehensive item information
 * including name, purchase date, quantity, location, value, tags, and a details button.
 */
const ItemsGrid: React.FC<Props> = ({ items, locationMap, tagMap, onOpenDetails }) => {
  return (
    {/* Responsive grid layout: 1 column on mobile, 2 on tablet, 3 on desktop */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Map over items array to render a card for each item */}
      {items.map((item) => (
        <article
          key={item.id}                                             // Unique key for React reconciliation
          className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          {/* Card header with item name, date, WODIS number, and quantity */}
          <header className="flex items-start justify-between gap-3">
            {/* Left side: item details */}
            <div>
              {/* Item name as primary heading */}
              <h4 className="text-lg font-semibold text-slate-900">{item.name}</h4>

              {/* Purchase date or fallback text */}
              <p className="text-xs text-slate-500">
                {item.purchase_date
                  ? new Date(item.purchase_date).toLocaleDateString('de-DE') // Format as German date (DD.MM.YYYY)
                  : 'Kaufdatum unbekannt'                               // German: "Purchase date unknown"
                }
              </p>

              {/* WODIS inventory number - conditional rendering */}
              {item.wodis_inventory_number && (
                <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  WODIS • {item.wodis_inventory_number}                  // Display WODIS identifier
                </div>
              )}
            </div>

            {/* Right side: quantity badge */}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {item.quantity}×                                         // Display quantity with multiplication sign
            </span>
          </header>

                  {/* Item description - conditional rendering if description exists */}
          {item.description && (
            <p className="mt-3 line-clamp-3 text-sm text-slate-600">{item.description}</p>
            // line-clamp-3: Limit to 3 lines with ellipsis for long descriptions
          )}

          {/* Details list: location and value */}
          <dl className="mt-4 grid gap-2 text-xs text-slate-500">
            {/* Location row */}
            <div className="flex items-center justify-between">
              <dt>Standort</dt>                                            // German: "Location"
              <dd className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {item.location
                  ? locationMap[item.location] ?? 'Unbekannt'            // Show location name or "Unknown" fallback
                  : 'Kein Standort'                                      // German: "No location"
                }
              </dd>
            </div>

            {/* Value row */}
            <div className="flex items-center justify-between">
              <dt>Wert</dt>                                               // German: "Value"
              <dd className="font-semibold text-slate-900">{formatCurrency(item.value)}</dd>
              // Format value as German Euro currency
            </div>
          </dl>

          {/* Tags section */}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.length > 0 ? (
              // Render tag pills if tags exist
              item.tags.map((tagId) => (
                <span
                  key={tagId}                                            // Unique key for React reconciliation
                  className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700"
                >
                  {tagMap[tagId] ?? `Tag ${tagId}`}                      // Show tag name or fallback to "Tag {id}"
                </span>
              ))
            ) : (
              // Show message when no tags are assigned
              <span className="text-xs text-slate-400">Keine Tags</span>
              // German: "No tags"
            )}
          </div>

          {/* Action button section */}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"                                           // Prevent form submission
              variant="secondary"                                     // Gray button style
              size="sm"                                               // Small button size
              onClick={() => onOpenDetails(item.id)}                  // Open details modal/panel
            >
              {/* German: "Details & QR Code" */}
              Details & QR-Code
            </Button>
          </div>
        </article>                                                   // Close article element
      ))}
    </div>                                                          // Close grid container
  );                                                               // Close return statement
};

export default ItemsGrid;                                         // Export as default component
