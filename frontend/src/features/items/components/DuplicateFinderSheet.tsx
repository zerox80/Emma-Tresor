import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import Button from '../../../components/common/Button';
import type { DuplicateGroup, DuplicateQuarantineEntry } from '../../../types/inventory';
import type { DuplicateStrictnessLevel, DuplicateStrictnessOption } from '../constants';

interface DuplicateFinderSheetProps {
  open: boolean;
  onClose: () => void;
  duplicates: DuplicateGroup[];
  loading: boolean;
  error: string | null;
  presetUsed: string | null;
  analyzedCount: number;
  limit: number;
  onRetry: () => Promise<void> | void;
  onOpenItemDetails: (itemId: number) => void;
  onMarkFalsePositive: (group: DuplicateGroup) => Promise<void>;
  markingGroupId: number | null;
  quarantineEntries: DuplicateQuarantineEntry[];
  quarantineLoading: boolean;
  quarantineError: string | null;
  onReloadQuarantine: () => Promise<void> | void;
  onReleaseEntry: (entryId: number) => Promise<void>;
  releasingEntryId: number | null;
  strictness: DuplicateStrictnessLevel;
  strictnessOptions: DuplicateStrictnessOption[];
  onStrictnessChange: (value: DuplicateStrictnessLevel) => void;
}

const getSuggestionsPageSize = () => {
  if (typeof window === 'undefined') {
    return 6;
  }
  return window.innerWidth < 640 ? 4 : 6;
};

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('de-DE');
  } catch (error) {
    return value;
  }
};

const DuplicateFinderSheet: React.FC<DuplicateFinderSheetProps> = ({
  open,
  onClose,
  duplicates,
  loading,
  error,
  presetUsed,
  analyzedCount,
  limit,
  onRetry,
  onOpenItemDetails,
  onMarkFalsePositive,
  markingGroupId,
  quarantineEntries,
  quarantineLoading,
  quarantineError,
  onReloadQuarantine,
  onReleaseEntry,
  releasingEntryId,
  strictness,
  strictnessOptions,
  onStrictnessChange,
}) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'quarantine'>('suggestions');
  const [quarantineSort, setQuarantineSort] = useState<'recent' | 'name'>('recent');
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsPageSize, setSuggestionsPageSize] = useState(getSuggestionsPageSize);
  const [sortPreference, setSortPreference] = useState<'default' | 'description' | 'date'>('default');

  const sortedDuplicates = useMemo(() => {
    if (sortPreference === 'default') {
      return duplicates;
    }

    return [...duplicates].sort((a, b) => {
      if (sortPreference === 'description') {
        const hasDescA = a.items.some((i) => i.description && i.description.trim().length > 0);
        const hasDescB = b.items.some((i) => i.description && i.description.trim().length > 0);
        if (hasDescA && !hasDescB) return -1;
        if (!hasDescA && hasDescB) return 1;
        return 0;
      }
      if (sortPreference === 'date') {
        const getDate = (group: DuplicateGroup) => {
          const dates = group.items
            .map((i) => (i.purchase_date ? new Date(i.purchase_date).getTime() : 0))
            .sort((d1, d2) => d2 - d1);
          return dates[0] || 0;
        };
        const dateA = getDate(a);
        const dateB = getDate(b);
        return dateB - dateA;
      }
      return 0;
    });
  }, [duplicates, sortPreference]);

  const sortedQuarantineEntries = useMemo(() => {
    if (quarantineSort === 'name') {
      return [...quarantineEntries].sort((a, b) => {
        const labelA = `${a.item_a.name} ${a.item_b.name}`.toLowerCase();
        const labelB = `${b.item_a.name} ${b.item_b.name}`.toLowerCase();
        return labelA.localeCompare(labelB);
      });
    }
    return quarantineEntries;
  }, [quarantineEntries, quarantineSort]);

  const totalGroups = duplicates.length;
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleResize = () => {
      setSuggestionsPageSize(getSuggestionsPageSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSuggestionsPage(1);
  }, [open, strictness, sortPreference]);

  useEffect(() => {
    if (strictness !== 'relaxed') {
      setSortPreference('default');
    }
  }, [strictness]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalGroups / suggestionsPageSize));
    setSuggestionsPage((previous) => Math.min(previous, maxPage));
  }, [totalGroups, suggestionsPageSize]);

  const totalSuggestionPages = Math.max(1, Math.ceil(totalGroups / suggestionsPageSize));
  const firstSuggestionIndex = (suggestionsPage - 1) * suggestionsPageSize;
  const visibleDuplicates = sortedDuplicates.slice(firstSuggestionIndex, firstSuggestionIndex + suggestionsPageSize);
  const showSuggestionsPagination = totalSuggestionPages > 1;

  const handleSuggestionsPrevious = () => {
    setSuggestionsPage((previous) => Math.max(1, previous - 1));
  };

  const handleSuggestionsNext = () => {
    setSuggestionsPage((previous) => Math.min(totalSuggestionPages, previous + 1));
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40 px-4 py-6 backdrop-blur-sm sm:px-8">
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Duplizierungs-Finder</p>
                <h2 className="text-2xl font-semibold text-slate-900">Gefundene Übereinstimmungen</h2>
                <p className="text-sm text-slate-500">
                  {loading
                    ? 'Analyse läuft …'
                    : totalGroups === 0
                      ? 'Keine Duplikate nach aktuellen Filtern gefunden.'
                      : `${totalGroups} Gruppen auf Basis von ${analyzedCount} geprüften Items (Limit ${limit}).`}
                </p>
                {presetUsed === 'auto' && <p className="text-xs text-slate-400">Automatische Analyse mit Name/ Beschreibung/ Kaufdatum.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Genauigkeit</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {strictnessOptions.map((option) => {
                    const isActive = option.id === strictness;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isActive}
                        className={clsx(
                          'flex min-w-[150px] flex-1 flex-col rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:min-w-[180px]',
                          isActive
                            ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-brand-200 hover:text-slate-900',
                        )}
                        onClick={() => onStrictnessChange(option.id)}
                      >
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 text-xs text-slate-500">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {strictness === 'relaxed' && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Priorisierung</p>
                  <div className="mt-2">
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none sm:w-auto"
                      value={sortPreference}
                      onChange={(e) => setSortPreference(e.target.value as any)}
                    >
                      <option value="default">Standard (Keine)</option>
                      <option value="description">Beschreibung vorhanden</option>
                      <option value="date">Kaufdatum (Neueste)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Schließen
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void onRetry()} loading={loading}>
                Aktualisieren
              </Button>
            </div>
          </header>

          <div className="flex flex-col sm:flex-row sm:overflow-hidden">
            <nav className="flex items-center gap-4 border-b border-slate-200 px-5 py-3 text-sm font-semibold sm:flex-col sm:border-b-0 sm:border-r sm:min-w-[220px] sm:max-w-[260px] sm:self-stretch sm:px-8 sm:py-6">
              <button
                type="button"
                className={clsx(
                  'rounded-full px-4 py-2 transition',
                  activeTab === 'suggestions' ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => setActiveTab('suggestions')}
              >
                Vorschläge ({totalGroups})
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-full px-4 py-2 transition',
                  activeTab === 'quarantine' ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => setActiveTab('quarantine')}
              >
                Quarantäne ({quarantineEntries.length})
              </button>
            </nav>

            <section className="flex-1 overflow-y-auto px-5 py-6 sm:max-h-[60vh] sm:px-8">
              {activeTab === 'suggestions' && (
                <SuggestionsSection
                  duplicates={visibleDuplicates}
                  loading={loading}
                  error={error}
                  onOpenItemDetails={onOpenItemDetails}
                  onMarkFalsePositive={onMarkFalsePositive}
                  markingGroupId={markingGroupId}
                  totalCount={totalGroups}
                  page={suggestionsPage}
                  pageCount={totalSuggestionPages}
                  onNextPage={handleSuggestionsNext}
                  onPreviousPage={handleSuggestionsPrevious}
                  showPagination={showSuggestionsPagination}
                />
              )}

              {activeTab === 'quarantine' && (
                <QuarantineSection
                  entries={sortedQuarantineEntries}
                  loading={quarantineLoading}
                  error={quarantineError}
                  onReload={onReloadQuarantine}
                  onReleaseEntry={onReleaseEntry}
                  releasingEntryId={releasingEntryId}
                  sort={quarantineSort}
                  onSortChange={setQuarantineSort}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SuggestionsSectionProps {
  duplicates: DuplicateGroup[];
  loading: boolean;
  error: string | null;
  onOpenItemDetails: (itemId: number) => void;
  onMarkFalsePositive: (group: DuplicateGroup) => Promise<void>;
  markingGroupId: number | null;
  totalCount: number;
  page: number;
  pageCount: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  showPagination: boolean;
}

const SuggestionsSection: React.FC<SuggestionsSectionProps> = ({
  duplicates,
  loading,
  error,
  onOpenItemDetails,
  onMarkFalsePositive,
  markingGroupId,
  totalCount,
  page,
  pageCount,
  onNextPage,
  onPreviousPage,
  showPagination,
}) => {
  if (loading) {
    return <p className="text-sm text-slate-500">Analyse läuft …</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (totalCount === 0) {
    return <p className="text-sm text-slate-500">Keine potenziellen Duplikate für die aktuellen Filter.</p>;
  }

  const disablePrevious = page <= 1;
  const disableNext = page >= pageCount;

  return (
    <div className="space-y-4">
      {duplicates.map((group) => (
        <article key={group.group_id} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Gruppe #{group.group_id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.match_reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void onMarkFalsePositive(group)}
              loading={markingGroupId === group.group_id}
            >
              Falsch-Positiv ausblenden
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {group.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                    <p className="text-xs text-slate-400">
                      Standort: {item.location ?? '—'} • Kaufdatum:{' '}
                      {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('de-DE') : 'unbekannt'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenItemDetails(item.id)}>
                      Details
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ))}

      {showPagination && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:justify-between">
          <p className="text-xs sm:text-sm">
            Seite {page} von {pageCount}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onPreviousPage} disabled={disablePrevious}>
              Zurück
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onNextPage} disabled={disableNext}>
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface QuarantineSectionProps {
  entries: DuplicateQuarantineEntry[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void> | void;
  onReleaseEntry: (entryId: number) => Promise<void>;
  releasingEntryId: number | null;
  sort: 'recent' | 'name';
  onSortChange: (value: 'recent' | 'name') => void;
}

const QuarantineSection: React.FC<QuarantineSectionProps> = ({
  entries,
  loading,
  error,
  onReload,
  onReleaseEntry,
  releasingEntryId,
  sort,
  onSortChange,
}) => {
  if (loading) {
    return <p className="text-sm text-slate-500">Quarantäne wird geladen …</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Quarantäne</h3>
          <p className="text-xs text-slate-500">Hier landen ausgeblendete Gruppen. Du kannst sie jederzeit zurückholen.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as 'recent' | 'name')}
          >
            <option value="recent">Neueste zuerst</option>
            <option value="name">Alphabetisch</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => void onReload()}>
            Aktualisieren
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {entries.length === 0 && !error && <p className="text-sm text-slate-500">Noch keine Einträge in der Quarantäne.</p>}

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {entry.item_a.name} ↔ {entry.item_b.name}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.reason || 'Ausgeblendet'} • {formatDateTime(entry.created_at)}
                </p>
                {entry.notes && <p className="text-xs text-slate-400">{entry.notes}</p>}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void onReleaseEntry(entry.id)}
                loading={releasingEntryId === entry.id}
              >
                Wieder anzeigen
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DuplicateFinderSheet;
