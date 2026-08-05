import React, { useMemo, useState } from "react";
import clsx from "clsx";

import type { EmployeeSummary } from "../../types/inventory";

interface EmployeeFilterProps {
  employees: EmployeeSummary[];
  loading: boolean;
  error: string | null;
  selectedEmployee: string | null;
  onEmployeeChange: (employee: string | null) => void;
  onRetry: () => void;
}

const normaliseSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de-DE")
    .trim();

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("de-DE");

const itemCountLabel = (count: number) =>
  count === 1 ? "1 Gegenstand" : `${count} Gegenstände`;

const EmployeeFilter: React.FC<EmployeeFilterProps> = ({
  employees,
  loading,
  error,
  selectedEmployee,
  onEmployeeChange,
  onRetry,
}) => {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const normalisedSearch = normaliseSearchValue(employeeSearch);

  const visibleEmployees = useMemo(() => {
    if (!normalisedSearch) {
      return employees;
    }
    return employees.filter((employee) =>
      normaliseSearchValue(employee.name).includes(normalisedSearch),
    );
  }, [employees, normalisedSearch]);

  const assignedItemCount = useMemo(
    () => employees.reduce((sum, employee) => sum + employee.item_count, 0),
    [employees],
  );

  const selectEmployee = (employeeName: string) => {
    const isSelected = selectedEmployee === employeeName;
    onEmployeeChange(isSelected ? null : employeeName);
    setEmployeeSearch("");
  };

  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border border-brand-100",
        "bg-gradient-to-br from-brand-50/80 via-white to-sky-50/70",
      ].join(" ")}
      aria-labelledby="employee-filter-title"
    >
      <div className="flex flex-col gap-4 border-b border-brand-100/80 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-200">
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9.5" cy="7" r="4" />
              <path
                d="M17 8v6m-3-3h6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="employee-filter-title"
                className="font-semibold text-slate-900"
              >
                Nach Mitarbeiter filtern
              </h3>
              {!loading && employees.length > 0 && (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
                  {employees.length} Mitarbeiter
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Alle zugeordneten Mitarbeiter sind direkt sichtbar. Tippe einen
              Namen ein oder wähle eine Person aus der Liste.
            </p>
          </div>
        </div>

        <div className="w-full lg:max-w-sm">
          <label
            htmlFor="employee-search"
            className="sr-only"
          >
            Mitarbeiter suchen
          </label>
          <div
            className={[
              "flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm",
              "focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200/60",
            ].join(" ")}
          >
            <svg
              aria-hidden="true"
              className="mr-2 h-4 w-4 shrink-0 text-slate-400"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="8.5" cy="8.5" r="4.5" />
              <path
                d="m12 12 4.5 4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              id="employee-search"
              type="search"
              autoComplete="off"
              placeholder="Mitarbeiter suchen …"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            />
            {employeeSearch && (
              <button
                type="button"
                className="ml-2 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setEmployeeSearch("")}
                aria-label="Mitarbeitersuche leeren"
              >
                Leeren
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Mitarbeiter werden geladen">
            {[0, 1, 2].map((entry) => (
              <div
                key={entry}
                className="h-[4.5rem] animate-pulse rounded-xl border border-slate-100 bg-white/80"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100"
              onClick={onRetry}
            >
              Erneut laden
            </button>
          </div>
        )}

        {!loading && !error && employees.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-700">
              Noch keine Mitarbeiter zugeordnet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sobald bei einem Gegenstand ein Mitarbeiter eingetragen ist,
              erscheint die Person automatisch hier.
            </p>
          </div>
        )}

        {!loading && !error && employees.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span aria-live="polite">
                {normalisedSearch
                  ? `${visibleEmployees.length} von ${employees.length} Mitarbeitern gefunden`
                  : `${employees.length} Mitarbeiter · ${itemCountLabel(assignedItemCount)} zugeordnet`}
                {selectedEmployee && (
                  <strong className="ml-1 font-semibold text-brand-800">
                    · Filter: {selectedEmployee}
                  </strong>
                )}
              </span>
              {selectedEmployee && (
                <button
                  type="button"
                  className="font-semibold text-brand-700 transition hover:text-brand-900 hover:underline"
                  onClick={() => onEmployeeChange(null)}
                >
                  Auswahl aufheben
                </button>
              )}
            </div>

            {visibleEmployees.length > 0 ? (
              <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEmployees.map((employee) => {
                  const isSelected = selectedEmployee === employee.name;
                  return (
                    <li key={employee.name}>
                      <button
                        type="button"
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
                          isSelected
                            ? "border-brand-400 bg-brand-500 text-white shadow-md shadow-brand-200/70"
                            : "border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md",
                        )}
                        onClick={() => selectEmployee(employee.name)}
                        aria-pressed={isSelected}
                      >
                        <span
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            isSelected
                              ? "bg-white/20 text-white ring-1 ring-white/30"
                              : "bg-gradient-to-br from-brand-100 to-sky-100 text-brand-700 ring-1 ring-brand-200/70",
                          )}
                          aria-hidden="true"
                        >
                          {getInitials(employee.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {employee.name}
                          </span>
                          <span
                            className={clsx(
                              "mt-0.5 block text-xs",
                              isSelected ? "text-brand-50" : "text-slate-500",
                            )}
                          >
                            {itemCountLabel(employee.item_count)}
                          </span>
                        </span>
                        <span
                          className={clsx(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            isSelected
                              ? "bg-white text-brand-600"
                              : "bg-slate-100 text-slate-400",
                          )}
                          aria-hidden="true"
                        >
                          {isSelected ? "✓" : "›"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Kein Mitarbeiter gefunden
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Prüfe die Schreibweise oder leere die Suche, um wieder alle
                  Mitarbeiter zu sehen.
                </p>
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
                  onClick={() => setEmployeeSearch("")}
                >
                  Alle Mitarbeiter anzeigen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default EmployeeFilter;
