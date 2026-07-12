import React from "react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import type { Location } from "../types/inventory";
import type { ItemFormSchema } from "./addItemForm";
import Button from "./common/Button";
import TagSelector, { type TagSelectorOption } from "./TagSelector";
import type { ItemFilePreview } from "./useItemFiles";

interface FormFieldsProps {
  register: UseFormRegister<ItemFormSchema>;
  errors: FieldErrors<ItemFormSchema>;
}

const inputClass = [
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm",
  "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60",
].join(" ");

export const AddItemBasicsStep: React.FC<FormFieldsProps> = ({ register, errors }) => (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <Field label="Name *" error={errors.name?.message}>
      <input id="add-item-name" className={inputClass} autoComplete="off" {...register("name")} />
    </Field>
    <Field label="Beschreibung" error={errors.description?.message}>
      <textarea id="add-item-description" rows={4} className={inputClass} {...register("description")} />
    </Field>
    <Field label="Wodis Inventarnummer" error={errors.wodis_inventory_number?.message}>
      <input id="add-item-wodis-inventory-number" className={inputClass} {...register("wodis_inventory_number")} />
    </Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Menge *" error={errors.quantity?.message}>
        <input
          id="add-item-quantity"
          type="number"
          min={1}
          step={1}
          className={inputClass}
          {...register("quantity", { valueAsNumber: true })}
        />
      </Field>
      <Field label="Wert (€)" error={errors.value?.message}>
        <input id="add-item-value" type="number" min={0} step="0.01" className={inputClass} {...register("value")} />
      </Field>
    </div>
    <Field label="Kaufdatum" error={errors.purchase_date?.message}>
      <input id="add-item-purchase-date" type="date" className={inputClass} {...register("purchase_date")} />
    </Field>
  </div>
);

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <label className="space-y-2 text-sm font-medium text-slate-800">
    <span>{label}</span>
    {children}
    {error && <span className="block text-xs text-red-500">{error}</span>}
  </label>
);

interface AssignmentStepProps extends FormFieldsProps {
  control: Control<ItemFormSchema>;
  locations: Location[];
  tagOptions: TagSelectorOption[];
  selectedTags: string[];
  selectedTagIds: number[];
  isSubmitting: boolean;
  isCreatingTag: boolean;
  tagCreationError: string | null;
  onCreateTag: (name: string) => Promise<TagSelectorOption | null>;
  newLocationName: string;
  setNewLocationName: (value: string) => void;
  onCreateLocation: () => void;
  isCreatingLocation: boolean;
  locationCreationError: string | null;
}

export const AddItemAssignmentStep: React.FC<AssignmentStepProps> = ({
  register,
  errors,
  control,
  locations,
  tagOptions,
  selectedTags,
  selectedTagIds,
  isSubmitting,
  isCreatingTag,
  tagCreationError,
  onCreateTag,
  newLocationName,
  setNewLocationName,
  onCreateLocation,
  isCreatingLocation,
  locationCreationError,
}) => (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <Field label="Standort" error={errors.location?.message}>
      <select
        id="add-item-location"
        className={inputClass}
        {...register("location", { setValueAs: (value) => (value === "" ? null : Number(value)) })}
      >
        <option value="">Kein Standort ausgewählt</option>
        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
      </select>
    </Field>
    <div className="rounded-lg border border-dashed border-slate-200 p-4">
      <p className="mb-2 text-sm font-medium text-slate-800">Neuen Standort hinzufügen</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={newLocationName}
          onChange={(event) => setNewLocationName(event.target.value)}
          className={inputClass}
          placeholder="z. B. Büro, Keller, Wohnzimmer"
        />
        <Button type="button" variant="secondary" onClick={onCreateLocation} loading={isCreatingLocation}>
          Speichern
        </Button>
      </div>
      {locationCreationError && <p className="mt-2 text-xs text-red-500">{locationCreationError}</p>}
    </div>
    <div className="space-y-2">
      <Controller
        control={control}
        name="tags"
        render={({ field }) => (
          <TagSelector
            options={tagOptions}
            selectedIds={field.value ?? []}
            onChange={field.onChange}
            onCreateTag={onCreateTag}
            disabled={isSubmitting}
            isCreating={isCreatingTag}
          />
        )}
      />
      {tagCreationError && <p className="text-xs text-red-500">{tagCreationError}</p>}
      {errors.tags && <p className="text-xs text-red-500">{errors.tags.message}</p>}
      {selectedTagIds.length > 0 && <p className="text-xs text-brand-700">{selectedTags.join(", ")}</p>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Mitarbeiter Name" error={errors.employee_name?.message}>
        <input className={inputClass} {...register("employee_name")} />
      </Field>
      <Field label="Raum Nr" error={errors.room_number?.message}>
        <input className={inputClass} {...register("room_number")} />
      </Field>
    </div>
  </div>
);

interface ReviewStepProps {
  values: ItemFormSchema;
  selectedLocationName: string;
  selectedTags: string[];
  filePreviews: ItemFilePreview[];
  fileFeedback: string | null;
  reviewSectionRef: React.RefObject<HTMLDivElement | null>;
  onSelectFiles: (files: FileList | null) => void;
  onRemoveFile: (name: string) => void;
  formatCurrency: (value: string | undefined) => string;
  formatDate: (value: string | undefined) => string;
}

export const AddItemReviewStep: React.FC<ReviewStepProps> = ({
  values,
  selectedLocationName,
  selectedTags,
  filePreviews,
  fileFeedback,
  reviewSectionRef,
  onSelectFiles,
  onRemoveFile,
  formatCurrency,
  formatDate,
}) => (
  <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <section ref={reviewSectionRef} tabIndex={-1} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h4 className="text-sm font-semibold uppercase text-slate-500">Zusammenfassung</h4>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Summary label="Name" value={values.name || "—"} />
        <Summary label="Wodis Inventarnummer" value={values.wodis_inventory_number || "—"} />
        <Summary label="Menge" value={String(values.quantity)} />
        <Summary label="Wert" value={formatCurrency(values.value)} />
        <Summary label="Kaufdatum" value={formatDate(values.purchase_date)} />
        <Summary label="Standort" value={selectedLocationName} />
        <Summary label="Tags" value={selectedTags.join(", ") || "Keine Tags"} />
        <Summary label="Mitarbeiter" value={values.employee_name || "—"} />
        <Summary label="Raum Nr" value={values.room_number || "—"} />
        <Summary label="Beschreibung" value={values.description || "—"} />
      </dl>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold uppercase text-slate-500">Dateien (optional)</h4>
          <p className="text-xs text-slate-500">Bilder und PDF-Dateien können ergänzt werden.</p>
        </div>
        <label className="cursor-pointer rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
          Dateien auswählen
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            hidden
            onChange={(event) => onSelectFiles(event.target.files)}
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filePreviews.map((preview) => (
          <article key={preview.url} className="overflow-hidden rounded-lg border border-slate-200">
            {preview.kind === "image" ? (
              <img src={preview.url} alt={preview.name} className="h-32 w-full object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center bg-slate-100">{preview.kind.toUpperCase()}</div>
            )}
            <div className="flex items-center justify-between gap-2 p-2 text-xs">
              <span className="truncate">{preview.name}</span>
              <button type="button" className="text-red-600" onClick={() => onRemoveFile(preview.name)}>
                Entfernen
              </button>
            </div>
          </article>
        ))}
      </div>
      {fileFeedback && <p className="mt-3 text-xs text-amber-700">{fileFeedback}</p>}
    </section>
  </div>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
  </div>
);
