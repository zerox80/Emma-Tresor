import React, { useMemo, useState } from 'react';
import clsx from 'clsx';

import Button from '../../../components/common/Button';
import type { DuplicateGroup, DuplicateQuarantineEntry } from '../../../types/inventory';

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
}

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
}) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'quarantine'>('suggestions');
  const [quarantineSort, setQuarantineSort] = useState<'recent' | 'name'>('recent');

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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40 px-4 py-6 backdrop-blur-sm sm:px-8">
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8">
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
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Schließen
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void onRetry()} loading={loading}>
              Aktualisieren
            </Button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row">
          <nav className="flex items-center gap-4 border-b border-slate-200 px-5 py-3 text-sm font-semibold sm:flex-col sm:border-b-0 sm:border-r sm:px-8 sm:py-6">
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

          <section className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {activeTab === 'suggestions' && (
              <SuggestionsSection
                duplicates={duplicates}
                loading={loading}
                error={error}
                onOpenItemDetails={onOpenItemDetails}
                onMarkFalsePositive={onMarkFalsePositive}
                markingGroupId={markingGroupId}
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
  );
};

interface SuggestionsSectionProps {
  duplicates: DuplicateGroup[];
  loading: boolean;
  error: string | null;
  onOpenItemDetails: (itemId: number) => void;
  onMarkFalsePositive: (group: DuplicateGroup) => Promise<void>;
  markingGroupId: number | null;
}

const SuggestionsSection: React.FC<SuggestionsSectionProps> = ({
  duplicates,
  loading,
  error,
  onOpenItemDetails,
  onMarkFalsePositive,
  markingGroupId,
}) => {
  if (loading) {
    return <p className="text-sm text-slate-500">Analyse läuft …</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (duplicates.length === 0) {
    return <p className="text-sm text-slate-500">Keine potenziellen Duplikate für die aktuellen Filter.</p>;
  }

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
