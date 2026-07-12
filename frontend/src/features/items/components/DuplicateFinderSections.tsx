import React from "react";
import clsx from "clsx";

import Button from "../../../components/common/Button";
import type {
  DuplicateGroup,
  DuplicateQuarantineEntry,
} from "../../../types/inventory";

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};
export interface SuggestionsSectionProps {
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

export const SuggestionsSection: React.FC<SuggestionsSectionProps> = ({
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
    return (
      <p className="text-sm text-slate-500">
        Keine potenziellen Duplikate für die aktuellen Filter.
      </p>
    );
  }

  const disablePrevious = page <= 1;
  const disableNext = page >= pageCount;

  return (
    <div className="space-y-4">
      {duplicates.map((group) => (
        <article
          key={group.group_id}
          className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                Gruppe #{group.group_id}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.match_reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                  >
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
              <li
                key={item.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Standort: {item.location ?? "—"} • Kaufdatum:{" "}
                      {item.purchase_date
                        ? new Date(item.purchase_date).toLocaleDateString(
                            "de-DE",
                          )
                        : "unbekannt"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenItemDetails(item.id)}
                    >
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
        <div
          className={[
            "mt-4 flex flex-col items-center gap-3 rounded-2xl border border-slate-200",
            "bg-white/80 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:justify-between",
          ].join(" ")}
        >
          <p className="text-xs sm:text-sm">
            Seite {page} von {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onPreviousPage}
              disabled={disablePrevious}
            >
              Zurück
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onNextPage}
              disabled={disableNext}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export interface QuarantineSectionProps {
  entries: DuplicateQuarantineEntry[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void> | void;
  onReleaseEntry: (entryId: number) => Promise<void>;
  releasingEntryId: number | null;
  sort: "recent" | "name";
  onSortChange: (value: "recent" | "name") => void;
}

export const QuarantineSection: React.FC<QuarantineSectionProps> = ({
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
          <p className="text-xs text-slate-500">
            Hier landen ausgeblendete Gruppen. Du kannst sie jederzeit
            zurückholen.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            value={sort}
            onChange={(event) =>
              onSortChange(event.target.value as "recent" | "name")
            }
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

      {entries.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          Noch keine Einträge in der Quarantäne.
        </p>
      )}

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {entry.item_a.name} ↔ {entry.item_b.name}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.reason || "Ausgeblendet"} •{" "}
                  {formatDateTime(entry.created_at)}
                </p>
                {entry.notes && (
                  <p className="text-xs text-slate-400">{entry.notes}</p>
                )}
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
