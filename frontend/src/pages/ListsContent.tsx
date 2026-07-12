import React from "react";

import Button from "../components/common/Button";
import ManageListItemsSheet, {
  type ManageableItem,
} from "../components/ManageListItemsSheet";
import type { Item } from "../types/inventory";
import type { ListWithItems } from "./ListsPage";

interface ListsContentProps {
  lists: ListWithItems[];
  loading: boolean;
  error: string | null;
  handleRefresh: () => Promise<void> | void;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenManageItems: (listId: number) => void;
  exportingListId: number | null;
  handleExportList: (listId: number, listName: string) => Promise<void> | void;
  deletingListId: number | null;
  handleDeleteList: (listId: number) => Promise<void> | void;
  deleteError: string | null;
  exportError: string | null;
  setExportError: React.Dispatch<React.SetStateAction<string | null>>;
  showCreateModal: boolean;
  handleCancelCreate: () => void;
  createError: string | null;
  newListName: string;
  setNewListName: React.Dispatch<React.SetStateAction<string>>;
  isCreating: boolean;
  handleCreateList: () => Promise<void> | void;
  manageListTarget: ListWithItems | null;
  handleCloseManageItems: () => void;
  manageableItems: ManageableItem[];
  manageSaving: boolean;
  manageError: string | null;
  handleSaveManageItems: (itemIds: number[]) => Promise<void>;
}

const ListsContent: React.FC<ListsContentProps> = ({
  lists,
  loading,
  error,
  handleRefresh,
  setShowCreateModal,
  handleOpenManageItems,
  exportingListId,
  handleExportList,
  deletingListId,
  handleDeleteList,
  deleteError,
  exportError,
  setExportError,
  showCreateModal,
  handleCancelCreate,
  createError,
  newListName,
  setNewListName,
  isCreating,
  handleCreateList,
  manageListTarget,
  handleCloseManageItems,
  manageableItems,
  manageSaving,
  manageError,
  handleSaveManageItems,
}) => {
  return (
    <div className="space-y-6 text-slate-700">
      <div
        className={[
          "flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/60 px-6 py-5",
          "shadow-sm backdrop-blur",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900">
              Benutzerdefinierte Listen
            </h2>
            <p className="text-sm text-slate-600">
              Struktur für jedes Vorhaben: Plane Umzüge, Projekte oder
              Reparaturen mit wenigen Klicks. Drag & Drop folgt bald.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              Neue Liste erstellen
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loading}
              onClick={handleRefresh}
            >
              Aktualisieren
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && lists.length === 0 && (
            <div
              className={[
                "rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center",
                "text-slate-500",
              ].join(" ")}
            >
              Lade Listen …
            </div>
          )}

          {!loading && lists.length === 0 && (
            <div
              className={[
                "rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center",
                "text-slate-500",
              ].join(" ")}
            >
              Noch keine Listen erstellt. Starte mit deiner ersten Sammlung und
              gruppiere Gegenstände nach Räumen oder Projekten.
            </div>
          )}

          {lists.map((list: ListWithItems) => {
            const itemCount = list.items.length;
            const itemCountLabel =
              itemCount === 1 ? "1 Item" : `${itemCount} Items`;
            return (
              <article
                key={list.id}
                className={[
                  "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br",
                  "from-white via-white to-slate-50 p-6 shadow-sm",
                ].join(" ")}
              >
                <header
                  className={[
                    "flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center",
                    "sm:justify-between",
                  ].join(" ")}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                      {itemCountLabel}
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {list.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenManageItems(list.id)}
                    >
                      Items bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={exportingListId === list.id}
                      onClick={() => void handleExportList(list.id, list.name)}
                    >
                      CSV exportieren
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDeleteList(list.id)}
                      disabled={deletingListId === list.id}
                    >
                      {deletingListId === list.id ? (
                        <span
                          className={[
                            "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-red-200",
                            "border-t-transparent",
                          ].join(" ")}
                        />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={
                              "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 " +
                              "01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-.447-2.236" +
                              "A2 2 0 0014.618 3H9.382a2 2 0 00-1.965 1.764L7 7"
                            }
                          />
                        </svg>
                      )}
                    </Button>
                  </div>
                </header>

                <ul className="space-y-3 text-sm text-slate-700">
                  {list.resolvedItems.slice(0, 6).map((item: Item) => (
                    <li
                      key={item.id}
                      className={[
                        "flex items-center justify-between rounded-xl border border-slate-200 bg-white/90",
                        "px-4 py-3 shadow-sm",
                      ].join(" ")}
                    >
                      <span className="font-medium text-slate-900">
                        {item.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {item.quantity}×
                      </span>
                    </li>
                  ))}
                  {list.resolvedItems.length === 0 && (
                    <li
                      className={[
                        "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs",
                        "text-slate-500",
                      ].join(" ")}
                    >
                      Noch keine Items zugeordnet – füge später beliebige
                      Gegenstände hinzu.
                    </li>
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {deleteError}
        </div>
      )}
      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="flex items-start justify-between gap-3">
            <span>{exportError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportError(null)}
            >
              Schließen
            </Button>
          </div>
        </div>
      )}

      {}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
          <div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden="true"
            onClick={handleCancelCreate}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-list-heading"
            className={[
              "relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl",
              "ring-1 ring-slate-900/10 sm:p-8",
            ].join(" ")}
          >
            <div className="mb-6">
              <h3
                id="create-list-heading"
                className="text-xl font-semibold text-slate-900"
              >
                Neue Liste erstellen
              </h3>
              <p className="text-sm text-slate-600">
                Erstelle eine neue Liste, um deine Gegenstände zu organisieren.
              </p>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="list-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Listenname
                </label>
                <input
                  id="list-name"
                  type="text"
                  value={newListName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewListName(e.target.value)
                  }
                  placeholder="z.B. Umzug Küche, Werkzeuge, …"
                  className={[
                    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800",
                    "shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2",
                    "focus:ring-brand-200/60",
                  ].join(" ")}
                  disabled={isCreating}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      void handleCreateList();
                    } else if (e.key === "Escape") {
                      handleCancelCreate();
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCancelCreate}
                disabled={isCreating}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleCreateList}
                loading={isCreating}
                className="flex-1"
              >
                Liste erstellen
              </Button>
            </div>
          </div>
        </div>
      )}

      <ManageListItemsSheet
        open={Boolean(manageListTarget)}
        onClose={handleCloseManageItems}
        listName={manageListTarget?.name ?? ""}
        items={manageableItems}
        initialSelectedIds={manageListTarget?.items ?? []}
        saving={manageSaving}
        error={manageError}
        onSave={handleSaveManageItems}
      />
    </div>
  );
};

export default ListsContent;
