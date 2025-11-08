import React from 'react';
import Button from '../common/Button';

/**
 * Props for the StatisticsCards component.
 */
type Props = {
  /** The total number of unique items. */
  totalItemsCount: number;
  /** The sum of quantities of all items. */
  totalQuantity: number;
  /** The sum of the financial value of all items. */
  totalValue: number;
  /** A boolean indicating if the statistics are currently being loaded. */
  loading: boolean;
  /** Callback function to open the dialog for adding a new item. */
  onAddItem: () => void;
  /** Callback function to trigger a reload of the statistics and item data. */
  onReload: () => void;
};

/**
 * A component that displays a set of cards with key statistics about the inventory,
 * such as total item count, total quantity, and estimated total value. It also includes
 * a card with quick actions like adding a new item or refreshing the data.
 *
 * @param {Props} props The props for the component.
 * @returns {JSX.Element} The rendered section containing the statistics cards.
 */
const StatisticsCards: React.FC<Props> = ({ totalItemsCount, totalQuantity, totalValue, loading, onAddItem, onReload }) => {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gesamtanzahl</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : totalItemsCount}</p>
        <p className="mt-1 text-xs text-slate-500">Alle Gegenstände, die deinen Filtern entsprechen.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summe Stückzahl</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : totalQuantity}</p>
        <p className="mt-1 text-xs text-slate-500">Wie viele Einheiten aktuell erfasst sind.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geschätzter Wert</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">
          {loading ? '…' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalValue)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Basierend auf deinen Angaben zum Kaufpreis.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schnellaktionen</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="primary" size="sm" onClick={onAddItem}>
            Gegenstand hinzufügen
          </Button>
          <Button variant="secondary" size="sm" onClick={onReload}>
            Aktualisieren
          </Button>
        </div>
      </article>
    </section>
  );
};

export default StatisticsCards;
