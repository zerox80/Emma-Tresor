// Filter Section Component
// ======================
// This component provides comprehensive filtering and sorting controls for the inventory items view.
// It includes search, tag filtering, location filtering, view mode toggling, and sorting options.

import React from 'react';                                       // Import React library for JSX
import clsx from 'clsx';                                       // Import utility for conditional CSS classes

import type { Tag, Location } from '../../types/inventory';     // Import TypeScript types for data structures

/**
 * Union type for available display modes of items.
 * Grid shows cards, Table shows detailed rows.
 */
type ViewMode = 'grid' | 'table';

/**
 * Props interface for FilterSection component.
 * Defines all the data and callbacks needed for filtering functionality.
 */
type Props = {
  /** Currently selected view mode (grid or table) */
  viewMode: ViewMode;

  /** Function to change the current view mode */
  setViewMode: (mode: ViewMode) => void;

  /** Whether any filters are currently active */
  isFiltered: boolean;

  /** Function to clear all active filters */
  onClearFilters: () => void;

  /** Current search term text */
  searchTerm: string;

  /** Function to update the search term */
  onSearchChange: (value: string) => void;

  /** Array of available tags for filtering */
  tags: Tag[];

  /** Array of available locations for filtering */
  locations: Location[];

  /** Loading state for metadata (tags and locations) */
  metaLoading: boolean;

  /** Array of currently selected tag IDs */
  selectedTagIds: number[];

  /** Function to toggle a tag selection (add/remove) */
  onToggleTag: (tagId: number) => void;

  /** Array of currently selected location IDs */
  selectedLocationIds: number[];

  /** Function to toggle a location selection (add/remove) */
  onToggleLocation: (locationId: number) => void;

  /** Current sorting option string */
  ordering: string;

  /** Function to update the sorting option */
  setOrdering: (ordering: string) => void;
};

/**
 * FilterSection Component Function.
 *
 * Renders a comprehensive filtering interface with search, tags, locations, sorting,
 * and view mode controls. Uses responsive design for mobile and desktop layouts.
 */
const FilterSection: React.FC<Props> = ({
  viewMode,                                                       // Current view mode (grid/table)
  setViewMode,                                                    // Function to change view mode
  isFiltered,                                                     // Whether any filters are active
  onClearFilters,                                                // Function to clear all filters
  searchTerm,                                                     // Current search input value
  onSearchChange,                                                // Function to update search term
  tags,                                                           // Available tags array
  locations,                                                      // Available locations array
  metaLoading,                                                    // Loading state for tags/locations
  selectedTagIds,                                                 // Currently selected tag IDs
  onToggleTag,                                                    // Function to toggle tag selection
  selectedLocationIds,                                            // Currently selected location IDs
  onToggleLocation,                                               // Function to toggle location selection
  ordering,                                                       // Current sorting option
  setOrdering,                                                    // Function to update sorting
}) => {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header section with title, description, and controls */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Title and description section */}
        <div className="flex flex-col gap-2">
          {/* German: "Filter Inventory" */}
          <h2 className="text-lg font-semibold text-slate-900">Inventar filtern</h2>
          {/* German description explaining filtering capabilities */}
          <p className="text-sm text-slate-600">
            Nutze Suche, Tags und Standorte – auch nach der Wodis Inventarnummer – um blitzschnell den richtigen Gegenstand zu finden.
          </p>
        </div>

        {/* Controls section: view mode toggle and clear filters */}
        <div className="flex items-center gap-3">
          {/* View mode toggle button group */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {/* Grid view toggle button */}
            <button
              type="button"                                               // Prevent form submission
              className={clsx(
                'rounded-md px-3 py-1 transition',                    // Base button styling with transition
                viewMode === 'grid'                                     // Active state styling
                  ? 'bg-white text-brand-600 shadow-sm'                 // White background, brand text, shadow
                  : 'hover:text-brand-600',                             // Inactive: brand color on hover
              )}
              onClick={() => setViewMode('grid')}                      // Switch to grid view
            >
              {/* German: "Cards" */}
              Karten
            </button>

            {/* Table view toggle button */}
            <button
              type="button"                                               // Prevent form submission
              className={clsx(
                'rounded-md px-3 py-1 transition',                    // Base button styling with transition
                viewMode === 'table'                                    // Active state styling
                  ? 'bg-white text-brand-600 shadow-sm'                 // White background, brand text, shadow
                  : 'hover:text-brand-600',                             // Inactive: brand color on hover
              )}
              onClick={() => setViewMode('table')}                     // Switch to table view
            >
              {/* German: "Table" */}
              Tabelle
            </button>
          </div>

          {/* Clear filters button - only shown when filters are active */}
          {isFiltered && (
            <button
              type="button"                                           // Prevent form submission
              className="text-sm text-brand-700 hover:underline"      // Link-like styling with brand color
              onClick={onClearFilters}                               // Clear all filters
            >
              {/* German: "Reset Filters" */}
              Filter zurücksetzen
            </button>
          )}
        </div>
      </header>

      {/* Three-column grid layout for search, tags, and locations */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Search input column */}
        <div className="lg:col-span-1">
          {/* Label for search input */}
          <label htmlFor="items-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {/* German: "Search" */}
            Suche
          </label>

          {/* Search input container with icon and input field */}
          <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60">
            {/* Search icon emoji */}
            <span className="mr-2 text-slate-400">🔍</span>

            {/* Search input field */}
            <input
              id="items-search"                                            // Unique ID for label association
              type="search"                                                // HTML5 search input type
              placeholder="Name, Wodis-Nr., Beschreibung oder Standort …"   // German placeholder text
              className="w-full border-none bg-transparent text-sm text-slate-900 outline-none" // Input styling
              value={searchTerm}                                           // Controlled component value
              onChange={(e) => onSearchChange(e.target.value)}            // Update search term on input
            />
          </div>
        </div>

        {/* Tags filter column */}
        <div className="lg:col-span-1">
          {/* Tags section label */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>

          {/* Tags container with flexbox layout for wrapping */}
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Loading state for tags */}
            {metaLoading && <span className="text-xs text-slate-400">Lade Tags …</span>}

            {/* Empty state when no tags are available */}
            {!metaLoading && tags.length === 0 && (
              <span className="text-xs text-slate-400">Noch keine Tags vorhanden.</span>
            )}

            {/* Render tag buttons when data is available */}
            {!metaLoading &&
              tags.map((tag) => (
                <button
                  key={tag.id}                                            // Unique key for React reconciliation
                  type="button"                                           // Prevent form submission
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition', // Base button styling
                    selectedTagIds.includes(tag.id)                       // Conditional styling based on selection
                      ? 'bg-brand-500 text-white shadow'                   // Selected: brand background, white text
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200', // Unselected: gray background, hover effect
                  )}
                  onClick={() => onToggleTag(tag.id)}                    // Toggle tag selection
                >
                  {tag.name}                                              // Display tag name
                </button>
              ))}
          </div>
        </div>

        {/* Locations filter column */}
        <div className="lg:col-span-1">
          {/* Locations section label */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Standorte</p>

          {/* Locations container with flexbox layout for wrapping */}
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Loading state for locations */}
            {metaLoading && <span className="text-xs text-slate-400">Lade Standorte …</span>}

            {/* Empty state when no locations are available */}
            {!metaLoading && locations.length === 0 && (
              <span className="text-xs text-slate-400">Noch keine Standorte vorhanden.</span>
            )}

            {/* Render location buttons when data is available */}
            {!metaLoading &&
              locations.map((location) => (
                <button
                  key={location.id}                                       // Unique key for React reconciliation
                  type="button"                                           // Prevent form submission
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition', // Base button styling
                    selectedLocationIds.includes(location.id)             // Conditional styling based on selection
                      ? 'bg-blue-500 text-white shadow'                   // Selected: blue background, white text (different from tags)
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200', // Unselected: gray background, hover effect
                  )}
                  onClick={() => onToggleLocation(location.id)}          // Toggle location selection
                >
                  {location.name}                                        // Display location name
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Sorting options section */}
      <div>
        {/* Sorting section label */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sortierung</p>

        {/* Sorting buttons container with flexbox layout for wrapping */}
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: 'Neueste Kaufdaten', value: '-purchase_date' },   // German: "Newest Purchase Date", descending order
            { label: 'Älteste Kaufdaten', value: 'purchase_date' },     // German: "Oldest Purchase Date", ascending order
            { label: 'Name A-Z', value: 'name' },                      // German: "Name A-Z", alphabetical ascending
            { label: 'Name Z-A', value: '-name' },                     // German: "Name Z-A", alphabetical descending
            { label: 'Höchste Menge', value: '-quantity' },            // German: "Highest Quantity", descending order
            { label: 'Höchster Wert', value: '-value' },               // German: "Highest Value", descending order
          ].map((option) => (
            <button
              key={option.value}                                        // Unique key for React reconciliation
              type="button"                                           // Prevent form submission
              className={clsx(
                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition', // Base button styling
                ordering === option.value                               // Conditional styling based on current selection
                  ? 'bg-slate-900 text-white shadow'                   // Active: dark background, white text
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200', // Inactive: light background, hover effect
              )}
              onClick={() => setOrdering(option.value)}               // Set this as the current sorting option
            >
              {option.label}                                           // Display German sorting label
            </button>
          ))}
        </div>
      </div>
    </section>                                                       // Close main section container
  );                                                               // Close return statement
};

export default FilterSection;                                     // Export as default component
