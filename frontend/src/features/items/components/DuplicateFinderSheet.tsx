import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import Button from "../../../components/common/Button";
import type {
  DuplicateGroup,
  DuplicateQuarantineEntry,
} from "../../../types/inventory";
import type {
  DuplicateStrictnessLevel,
  DuplicateStrictnessOption,
} from "../constants";
import {
  QuarantineSection,
  SuggestionsSection,
} from "./DuplicateFinderSections";

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
  if (typeof window === "undefined") {
    return 6;
  }
  return window.innerWidth < 640 ? 4 : 6;
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
  const [activeTab, setActiveTab] = useState<"suggestions" | "quarantine">(
    "suggestions",
  );
  const [quarantineSort, setQuarantineSort] = useState<"recent" | "name">(
    "recent",
  );
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsPageSize, setSuggestionsPageSize] = useState(
    getSuggestionsPageSize,
  );
  const [sortPreference, setSortPreference] = useState<
    "default" | "description" | "date"
  >("default");

  const sortedDuplicates = useMemo(() => {
    // Create a shallow copy of groups and items to avoid mutating props
    const processed = duplicates.map((group) => ({
      ...group,
      items: [...group.items],
    }));

    if (sortPreference === "default") {
      return processed;
    }

    if (sortPreference === "description") {
      // Sort items within groups: Description alphabetical, empty at bottom
      processed.forEach((group) => {
        group.items.sort((a, b) => {
          const descA = a.description || "";
          const descB = b.description || "";
          if (descA && !descB) return -1;
          if (!descA && descB) return 1;
          return descA.localeCompare(descB);
        });
      });

      // Sort groups: Groups with any description first
      processed.sort((a, b) => {
        const hasDescA = a.items.some(
          (i) => i.description && i.description.trim().length > 0,
        );
        const hasDescB = b.items.some(
          (i) => i.description && i.description.trim().length > 0,
        );
        if (hasDescA && !hasDescB) return -1;
        if (!hasDescA && hasDescB) return 1;
        return 0;
      });
    }

    if (sortPreference === "date") {
      // Sort items within groups: Newest first
      processed.forEach((group) => {
        group.items.sort((a, b) => {
          const dateA = a.purchase_date
            ? new Date(a.purchase_date).getTime()
            : 0;
          const dateB = b.purchase_date
            ? new Date(b.purchase_date).getTime()
            : 0;
          return dateB - dateA;
        });
      });

      // Sort groups: Newest date in group first
      processed.sort((a, b) => {
        const getDate = (group: DuplicateGroup) => {
          // Items are already sorted, so first is newest
          const firstItem = group.items[0];
          return firstItem?.purchase_date
            ? new Date(firstItem.purchase_date).getTime()
            : 0;
        };
        return getDate(b) - getDate(a);
      });
    }

    return processed;
  }, [duplicates, sortPreference]);

  const sortedQuarantineEntries = useMemo(() => {
    if (quarantineSort === "name") {
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
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setSuggestionsPageSize(getSuggestionsPageSize());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSuggestionsPage(1);
  }, [open, strictness, sortPreference]);

  useEffect(() => {
    if (strictness !== "relaxed" && strictness !== "very_relaxed") {
      setSortPreference("default");
    }
  }, [strictness]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalGroups / suggestionsPageSize));
    setSuggestionsPage((previous) => Math.min(previous, maxPage));
  }, [totalGroups, suggestionsPageSize]);

  const totalSuggestionPages = Math.max(
    1,
    Math.ceil(totalGroups / suggestionsPageSize),
  );
  const firstSuggestionIndex = (suggestionsPage - 1) * suggestionsPageSize;
  const visibleDuplicates = sortedDuplicates.slice(
    firstSuggestionIndex,
    firstSuggestionIndex + suggestionsPageSize,
  );
  const showSuggestionsPagination = totalSuggestionPages > 1;

  const handleSuggestionsPrevious = () => {
    setSuggestionsPage((previous) => Math.max(1, previous - 1));
  };

  const handleSuggestionsNext = () => {
    setSuggestionsPage((previous) =>
      Math.min(totalSuggestionPages, previous + 1),
    );
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40 px-4 py-6 backdrop-blur-sm sm:px-8">
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header
            className={[
              "flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row",
              "sm:items-start sm:justify-between sm:px-8",
            ].join(" ")}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                  Duplizierungs-Finder
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Gefundene Übereinstimmungen
                </h2>
                <p className="text-sm text-slate-500">
                  {loading
                    ? "Analyse läuft …"
                    : totalGroups === 0
                      ? "Keine Duplikate nach aktuellen Filtern gefunden."
                      : `${totalGroups} Gruppen auf Basis von ${analyzedCount} geprüften Items (Limit ${limit}).`}
                </p>
                {presetUsed === "auto" && (
                  <p className="text-xs text-slate-400">
                    Automatische Analyse mit Name/ Beschreibung/ Kaufdatum.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Genauigkeit
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {strictnessOptions.map((option) => {
                    const isActive = option.id === strictness;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isActive}
                        className={clsx(
                          "flex min-w-[150px] flex-1 flex-col rounded-2xl border " +
                            "px-4 py-3 text-left transition focus-visible:outline " +
                            "focus-visible:outline-2 focus-visible:outline-offset-2 " +
                            "focus-visible:outline-brand-500 sm:min-w-[180px]",
                          isActive
                            ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm"
                            : "border-slate-200 text-slate-600 hover:border-brand-200 hover:text-slate-900",
                        )}
                        onClick={() => onStrictnessChange(option.id)}
                      >
                        <span className="text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-1 text-xs text-slate-500">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {(strictness === "relaxed" || strictness === "very_relaxed") && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Priorisierung
                  </p>
                  <div className="mt-2">
                    <select
                      className={[
                        "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm",
                        "text-slate-700 focus:border-brand-500 focus:outline-none sm:w-auto",
                      ].join(" ")}
                      value={sortPreference}
                      onChange={(event) =>
                        setSortPreference(
                          event.target.value as typeof sortPreference,
                        )
                      }
                    >
                      <option value="default">Standard (Keine)</option>
                      <option value="description">
                        Beschreibung vorhanden
                      </option>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onRetry()}
                loading={loading}
              >
                Aktualisieren
              </Button>
            </div>
          </header>

          <div className="flex flex-col sm:flex-row sm:overflow-hidden">
            <nav
              className={[
                "flex items-center gap-4 border-b border-slate-200 px-5 py-3 text-sm",
                "font-semibold sm:flex-col sm:border-b-0 sm:border-r sm:min-w-[220px]",
                "sm:max-w-[260px] sm:self-stretch sm:px-8 sm:py-6",
              ].join(" ")}
            >
              <button
                type="button"
                className={clsx(
                  "rounded-full px-4 py-2 transition",
                  activeTab === "suggestions"
                    ? "bg-brand-100 text-brand-700"
                    : "text-slate-500 hover:text-slate-700",
                )}
                onClick={() => setActiveTab("suggestions")}
              >
                Vorschläge ({totalGroups})
              </button>
              <button
                type="button"
                className={clsx(
                  "rounded-full px-4 py-2 transition",
                  activeTab === "quarantine"
                    ? "bg-brand-100 text-brand-700"
                    : "text-slate-500 hover:text-slate-700",
                )}
                onClick={() => setActiveTab("quarantine")}
              >
                Quarantäne ({quarantineEntries.length})
              </button>
            </nav>

            <section className="flex-1 overflow-y-auto px-5 py-6 sm:max-h-[60vh] sm:px-8">
              {activeTab === "suggestions" && (
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

              {activeTab === "quarantine" && (
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

export default DuplicateFinderSheet;
