// Statistics Cards Component
// =========================
// This component displays dashboard statistics cards showing item counts, quantities,
// total value, and quick action buttons. It provides an overview of the inventory
// and quick access to common operations.

import React from 'react';                                       // Import React library for JSX
import Button from '../common/Button';                           // Import reusable Button component

/**
 * Props interface for StatisticsCards component.
 * Defines the data to display and action callbacks for user interactions.
 */
type Props = {
  /** Total number of unique items in the inventory */
  totalItemsCount: number;

  /** Sum of quantities across all items (total units) */
  totalQuantity: number;

  /** Total monetary value of all items combined */
  totalValue: number;

  /** Whether the statistics data is currently loading */
  loading: boolean;

  /** Callback function triggered when user wants to add a new item */
  onAddItem: () => void;

  /** Callback function triggered when user wants to refresh the data */
  onReload: () => void;
};

/**
 * Statistics Cards Component Function.
 *
 * Renders four cards in a responsive grid layout displaying inventory statistics
 * and quick action buttons. Shows loading states and formatted numbers/values.
 */
const StatisticsCards: React.FC<Props> = ({ totalItemsCount, totalQuantity, totalValue, loading, onAddItem, onReload }) => {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {/* Total Items Count Card */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Card title */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gesamtanzahl</p>
        {/* German: "Total Count" */}

        {/* Main statistic value */}
        <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : totalItemsCount}</p>
        {/* Show loading dots or actual count */}

        {/* Description text */}
        <p className="mt-1 text-xs text-slate-500">Alle Gegenstände, die deinen Filtern entsprechen.</p>
        {/* German: "All items that match your filters" */}
      </article>

      {/* Total Quantity Card */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Card title */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summe Stückzahl</p>
        {/* German: "Total Quantity" */}

        {/* Main statistic value */}
        <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : totalQuantity}</p>
        {/* Show loading dots or total quantity */}

        {/* Description text */}
        <p className="mt-1 text-xs text-slate-500">Wie viele Einheiten aktuell erfasst sind.</p>
        {/* German: "How many units are currently recorded" */}
      </article>

      {/* Total Value Card */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Card title */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geschätzter Wert</p>
        {/* German: "Estimated Value" */}

        {/* Main statistic value with German Euro formatting */}
        <p className="mt-2 text-3xl font-bold text-slate-900">
          {loading
            ? '…'                                                     // Loading dots
            : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalValue) // German currency format
          }
        </p>

        {/* Description text */}
        <p className="mt-1 text-xs text-slate-500">Basierend auf deinen Angaben zum Kaufpreis.</p>
        {/* German: "Based on your purchase price information" */}
      </article>

      {/* Quick Actions Card */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Card title */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schnellaktionen</p>
        {/* German: "Quick Actions" */}

        {/* Action buttons container */}
        <div className="mt-3 flex flex-wrap gap-3">
          {/* Add new item button */}
          <Button
            variant="primary"                                       // Brand color button
            size="sm"                                               // Small button size
            onClick={onAddItem}                                     // Open add item dialog
          >
            {/* German: "Add item" */}
            Gegenstand hinzufügen
          </Button>

          {/* Refresh data button */}
          <Button
            variant="secondary"                                     // Gray button style
            size="sm"                                               // Small button size
            onClick={onReload}                                      // Refresh statistics data
          >
            {/* German: "Refresh" */}
            Aktualisieren
          </Button>
        </div>
      </article>
    </section>                                                       // Close grid container
  );                                                               // Close return statement
};

export default StatisticsCards;                                   // Export as default component
