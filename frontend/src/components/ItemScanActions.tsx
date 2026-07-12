import React from "react";
import Button from "./common/Button";

interface ItemScanActionsProps {
  canDelete: boolean;
  confirmingDelete: boolean;
  confirmDeleteRef: React.RefObject<HTMLDivElement | null>;
  deleteConfirmTitleId: string;
  deleteConfirmDescriptionId: string;
  deleteLoading: boolean;
  deleteError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  setConfirmingDelete: (value: boolean) => void;
}

const ItemScanActions: React.FC<ItemScanActionsProps> = ({
  canDelete,
  confirmingDelete,
  confirmDeleteRef,
  deleteConfirmTitleId,
  deleteConfirmDescriptionId,
  deleteLoading,
  deleteError,
  onClose,
  onEdit,
  onDelete,
  setConfirmingDelete,
}) => (
  <div className="mt-8 space-y-4">
    {deleteError && (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        role="alert"
      >
        {deleteError}
      </div>
    )}
    {confirmingDelete && canDelete ? (
      <div
        className={[
          "flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row",
          "sm:items-center sm:justify-between",
        ].join(" ")}
        role="alertdialog"
        aria-modal="false"
        aria-labelledby={deleteConfirmTitleId}
        aria-describedby={deleteConfirmDescriptionId}
        ref={confirmDeleteRef}
        tabIndex={-1}
      >
        <div>
          <p id={deleteConfirmTitleId} className="text-sm font-semibold text-red-700">
            Gegenstand wirklich löschen?
          </p>
          <p id={deleteConfirmDescriptionId} className="mt-1 text-sm text-red-600">
            Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten und Dateien des Gegenstands werden entfernt.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleteLoading}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDelete}
            loading={deleteLoading}
            disabled={deleteLoading}
          >
            Jetzt löschen
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canDelete && (
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
            Gegenstand löschen
          </Button>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
          <Button type="button" variant="primary" onClick={onEdit}>
            Bearbeiten
          </Button>
        </div>
      </div>
    )}
  </div>
);

export default ItemScanActions;
