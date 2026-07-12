import React from "react";
import type { Item } from "../types/inventory";
import Button from "./common/Button";

interface AddItemSuccessProps {
  item: Item;
  uploadWarning: string | null;
  onAddAnother: () => void;
  onClose: () => void;
  onRequestClose: () => void;
}

const AddItemSuccess: React.FC<AddItemSuccessProps> = ({
  item,
  uploadWarning,
  onAddAnother,
  onClose,
  onRequestClose,
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div
      className="flex min-h-full items-start justify-center bg-slate-900/40 p-4 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-success-heading"
        className={[
          "relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl ring-1",
          "ring-slate-900/10 sm:rounded-3xl sm:p-8",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 text-center">
          <div
            className={[
              "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
              "bg-emerald-100 text-emerald-600",
            ].join(" ")}
          >
            <span className="text-3xl" aria-hidden="true">✓</span>
          </div>
          <h3 id="add-item-success-heading" className="text-2xl font-semibold text-slate-900">
            Gegenstand erfolgreich angelegt
          </h3>
          <p className="mt-1 text-sm text-slate-600">„{item.name}“ wurde deinem Inventar hinzugefügt.</p>
          {uploadWarning && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {uploadWarning}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="primary" size="md" onClick={onAddAnother}>
            Weiteren Gegenstand anlegen
          </Button>
          <Button variant="secondary" size="md" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export default AddItemSuccess;
