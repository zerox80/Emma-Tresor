import React from "react";

import Button from "../components/common/Button";
import ListItemsPreviewSheet from "../components/ListItemsPreviewSheet";
import ManageListItemsSheet, {
  type ManageableItem,
} from "../components/ManageListItemsSheet";
import type { Item } from "../types/inventory";
import type { DashboardStats, ListWithDetail } from "./DashboardPage";

const MAX_LISTS_DISPLAYED = 4;

interface DashboardContentProps {
  error: string | null;
  loading: boolean;
  stats: DashboardStats | null;
  itemsTotalValue: number;
  listsWithDetail: ListWithDetail[];
  showAllLists: boolean;
  setShowAllLists: React.Dispatch<React.SetStateAction<boolean>>;
  expandedLists: Set<number>;
  handleToggleList: (listId: number) => void;
  listExportError: string | null;
  setListExportError: React.Dispatch<React.SetStateAction<string | null>>;
  listExportingId: number | null;
  handleExportOverviewList: (list: ListWithDetail) => Promise<void> | void;
  handleOpenPreview: (listId: number) => void;
  handleOpenManage: (listId: number) => void;
  locationLookup: Map<number, string>;
  manageTarget: ListWithDetail | null;
  handleCloseManage: () => void;
  manageableItems: ManageableItem[];
  manageSaving: boolean;
  manageError: string | null;
  handleSaveManage: (itemIds: number[]) => Promise<void>;
  previewTarget: ListWithDetail | null;
  handleClosePreview: () => void;
  handlePreviewItemDetails: (item: Item) => void;
  handleExportPreviewList: () => Promise<void> | void;
  previewExporting: boolean;
  previewExportError: string | null;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  error,
  loading,
  stats,
  itemsTotalValue,
  listsWithDetail,
  showAllLists,
  setShowAllLists,
  expandedLists,
  handleToggleList,
  listExportError,
  setListExportError,
  listExportingId,
  handleExportOverviewList,
  handleOpenPreview,
  handleOpenManage,
  locationLookup,
  manageTarget,
  handleCloseManage,
  manageableItems,
  manageSaving,
  manageError,
  handleSaveManage,
  previewTarget,
  handleClosePreview,
  handlePreviewItemDetails,
  handleExportPreviewList,
  previewExporting,
  previewExportError,
}) => {
  return (
    <div className="space-y-8 text-slate-700">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Gesamtbestand</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "…" : (stats?.items.length ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Alle erfassten Gegenstände deiner privaten EmmaTresor-Sammlung.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Listen</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "…" : (stats?.lists.length ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Smarte Sammlungen für Projekte, Umzüge und Übergaben.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">
            Geschätzter Wert
          </h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading
              ? "…"
              : new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                }).format(itemsTotalValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Basierend auf deinen hinterlegten Kaufpreisen – jederzeit anpassbar.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Struktur</h3>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {loading
              ? "…"
              : `${stats?.tags.length ?? 0} Tags · ${stats?.locations.length ?? 0} Orte`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verleihe deinem Inventar Kontext – blitzschnell filterbar.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Zuletzt hinzugefügt
            </h2>
            <span className="text-xs text-slate-500">
              Automatisch aktualisiert
            </span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {loading && <li className="text-slate-400">Lade Items …</li>}
            {!loading &&
              stats?.items.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2"
                >
                  <span className="font-medium text-slate-900">
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.quantity}× ·{" "}
                    {item.purchase_date
                      ? new Date(item.purchase_date).toLocaleDateString("de-DE")
                      : "Datum unbekannt"}
                  </span>
                </li>
              ))}
            {!loading && stats?.items.length === 0 && (
              <li className="text-slate-400">
                Noch keine Gegenstände angelegt – starte mit deinem ersten
                Eintrag in EmmaTresor.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Aktive Listen
            </h2>
            <span className="text-xs text-slate-500">
              Direkt hier bearbeiten
            </span>
          </div>

          {listExportError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              <div className="flex items-start justify-between gap-3">
                <span>{listExportError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setListExportError(null)}
                >
                  Schließen
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <p className="mt-4 text-sm text-slate-400">Lade Listen …</p>
          )}

          {!loading && listsWithDetail.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">
              Noch keine Listen erstellt – starte mit deiner ersten Sammlung.
            </p>
          )}

          {!loading && listsWithDetail.length > 0 && (
            <ul className="mt-4 space-y-4">
              {(showAllLists
                ? listsWithDetail
                : listsWithDetail.slice(0, MAX_LISTS_DISPLAYED)
              ).map((list) => {
                const hasItems = list.resolvedItems.length > 0;
                const isExpanded = expandedLists.has(list.id);
                return (
                  <li
                    key={list.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-t-xl border-b",
                        "border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => handleToggleList(list.id)}
                    >
                      <span className="text-sm font-semibold text-slate-900">
                        {list.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{list.items.length} Items</span>
                        <span className="text-lg leading-none text-slate-400">
                          {isExpanded ? "−" : "+"}
                        </span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-4 px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs uppercase tracking-wide text-brand-500">
                            Listen-Items
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPreview(list.id)}
                            >
                              Liste ansehen
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              loading={listExportingId === list.id}
                              onClick={() =>
                                void handleExportOverviewList(list)
                              }
                            >
                              CSV exportieren
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenManage(list.id)}
                            >
                              Items verwalten
                            </Button>
                          </div>
                        </div>

                        {!hasItems && (
                          <div
                            className={[
                              "rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm",
                              "text-slate-500",
                            ].join(" ")}
                          >
                            Noch keine Gegenstände in dieser Liste. Füge welche
                            hinzu, um direkt loszulegen.
                          </div>
                        )}

                        {hasItems && (
                          <ul className="space-y-2 text-sm text-slate-600">
                            {list.resolvedItems
                              .slice(0, 4)
                              .map((item: Item) => {
                                const locationName = item.location
                                  ? (locationLookup.get(item.location) ??
                                    "Ort unbekannt")
                                  : "Ort unbekannt";
                                return (
                                  <li
                                    key={item.id}
                                    className={[
                                      "flex items-center justify-between rounded-lg border " +
                                        "border-slate-100 bg-slate-50",
                                      "px-3 py-2",
                                    ].join(" ")}
                                  >
                                    <span className="font-medium text-slate-900">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {item.quantity}× · {locationName}
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        )}

                        {hasItems && list.resolvedItems.length > 4 && (
                          <p className="text-xs text-slate-400">
                            … und {list.resolvedItems.length - 4} weitere
                            Gegenstände
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}

              {!showAllLists &&
                listsWithDetail.length > MAX_LISTS_DISPLAYED && (
                  <li
                    className={[
                      "flex items-center justify-between rounded-xl border border-dashed",
                      "border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500",
                    ].join(" ")}
                  >
                    <span>
                      {listsWithDetail.length - MAX_LISTS_DISPLAYED} weitere
                      Listen sind vorhanden.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllLists(true)}
                    >
                      Laden
                    </Button>
                  </li>
                )}
            </ul>
          )}
        </div>
      </section>

      <ManageListItemsSheet
        open={Boolean(manageTarget)}
        onClose={handleCloseManage}
        listName={manageTarget?.name ?? ""}
        items={manageableItems}
        initialSelectedIds={manageTarget?.items ?? []}
        saving={manageSaving}
        error={manageError}
        onSave={handleSaveManage}
      />

      <ListItemsPreviewSheet
        open={Boolean(previewTarget)}
        onClose={handleClosePreview}
        listName={previewTarget?.name ?? ""}
        items={previewTarget?.resolvedItems ?? []}
        getLocationName={(locationId: number | null) => {
          if (locationId === null) {
            return "Ort unbekannt";
          }
          return locationLookup.get(locationId) ?? "Ort unbekannt";
        }}
        onOpenItemDetails={handlePreviewItemDetails}
        onExportList={handleExportPreviewList}
        exporting={previewExporting}
        exportError={previewExportError}
      />
    </div>
  );
};

export default DashboardContent;
