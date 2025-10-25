import React from 'react';
import clsx from 'clsx';

import type { Tag, Location } from '../../types/inventory';

type ViewMode = 'grid' | 'table';

type Props = {
  /** The current view mode ('grid' or 'table'). */
  viewMode: ViewMode;
  /** Callback to set the view mode. */
  setViewMode: (mode: ViewMode) => void;
  /** Whether any filters are currently active. */
  isFiltered: boolean;
  /** Callback to clear all filters. */
  onClearFilters: () => void;
  /** The current search term. */
  searchTerm: string;
  /** Callback to update the search term. */
  onSearchChange: (value: string) => void;
  /** The list of available tags. */
  tags: Tag[];
  /** The list of available locations. */
  locations: Location[];
  /** Whether the tags and locations are currently loading. */
  metaLoading: boolean;
  /** The list of selected tag IDs. */
  selectedTagIds: number[];
  /** Callback to toggle a tag's selection status. */
  onToggleTag: (tagId: number) => void;
  /** The list of selected location IDs. */
  selectedLocationIds: number[];
  /** Callback to toggle a location's selection status. */
  onToggleLocation: (locationId: number) => void;
  /** The current ordering string. */
  ordering: string;
  /** Callback to set the ordering. */
  setOrdering: (ordering: string) => void;
};

/**
 * A component that provides UI for filtering and sorting a list of items.
 *
 * @param {Props} props The props for the component.
 * @returns {JSX.Element} The rendered filter section.
 */
const FilterSection: React.FC<Props> = ({
  viewMode,
  setViewMode,
  isFiltered,
  onClearFilters,
  searchTerm,
  onSearchChange,
  tags,
  locations,
  metaLoading,
  selectedTagIds,
  onToggleTag,
  selectedLocationIds,
  onToggleLocation,
  ordering,
  setOrdering,
}) => {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Inventar filtern</h2>
          <p className="text-sm text-slate-600">
            Nutze Suche, Tags und Standorte – auch nach der Wodis Inventarnummer – um blitzschnell den richtigen Gegenstand zu finden.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <button
              type="button"
              className={clsx(
                'rounded-md px-3 py-1 transition',
                viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'hover:text-brand-600',
              )}
              onClick={() => setViewMode('grid')}
            >
              Karten
            </button>
            <button
              type="button"
              className={clsx(
                'rounded-md px-3 py-1 transition',
                viewMode === 'table' ? 'bg-white text-brand-600 shadow-sm' : 'hover:text-brand-600',
              )}
              onClick={() => setViewMode('table')}
            >
              Tabelle
            </button>
          </div>
          {isFiltered && (
            <button type="button" className="text-sm text-brand-700 hover:underline" onClick={onClearFilters}>
              Filter zurücksetzen
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label htmlFor="items-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Suche
          </label>
          <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60">
            <span className="mr-2 text-slate-400">🔍</span>
            <input
              id="items-search"
              type="search"
              placeholder="Name, Wodis-Nr., Beschreibung oder Standort …"
              className="w-full border-none bg-transparent text-sm text-slate-900 outline-none"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {metaLoading && <span className="text-xs text-slate-400">Lade Tags …</span>}
            {!metaLoading && tags.length === 0 && (
              <span className="text-xs text-slate-400">Noch keine Tags vorhanden.</span>
            )}
            {!metaLoading &&
              tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                    selectedTagIds.includes(tag.id)
                      ? 'bg-brand-500 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                  onClick={() => onToggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Standorte</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {metaLoading && <span className="text-xs text-slate-400">Lade Standorte …</span>}
            {!metaLoading && locations.length === 0 && (
              <span className="text-xs text-slate-400">Noch keine Standorte vorhanden.</span>
            )}
            {!metaLoading &&
              locations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                    selectedLocationIds.includes(location.id)
                      ? 'bg-blue-500 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                  onClick={() => onToggleLocation(location.id)}
                >
                  {location.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sortierung</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: 'Neueste Kaufdaten', value: '-purchase_date' },
            { label: 'Älteste Kaufdaten', value: 'purchase_date' },
            { label: 'Name A-Z', value: 'name' },
            { label: 'Name Z-A', value: '-name' },
            { label: 'Höchste Menge', value: '-quantity' },
            { label: 'Höchster Wert', value: '-value' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={clsx(
                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition',
                ordering === option.value
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
              onClick={() => setOrdering(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FilterSection;
