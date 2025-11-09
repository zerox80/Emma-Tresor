import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Button from './common/Button.tsx';
import TagSelector from './TagSelector.tsx';
import type { TagSelectorOption } from './TagSelector.tsx';
import {
  createItem,
  updateItem,
  uploadItemImage,
} from '../api/inventory';
import { FILE_UPLOAD_CONSTANTS } from '../utils/constants';
import type { Item, ItemImage, ItemPayload, Location, Tag } from '../types/inventory';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: Item) => void;
  tags: Tag[];
  locations: Location[];
  onCreateTag: (name: string) => Promise<Tag>;
  onCreateLocation: (name: string) => Promise<Location>;
  mode?: 'create' | 'edit';
  item?: Item | null;
  onUpdated?: (item: Item, warning?: string | null) => void;
}

const MAX_FILES = FILE_UPLOAD_CONSTANTS.MAX_FILES;
const MAX_FILE_SIZE_MB = FILE_UPLOAD_CONSTANTS.MAX_FILE_SIZE_MB;
const ALLOWED_EXTENSIONS = FILE_UPLOAD_CONSTANTS.ALLOWED_EXTENSIONS;

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf höchstens 255 Zeichen enthalten.'),
  description: z
    .string()
    .max(2000, 'Die Beschreibung ist zu lang (maximal 2000 Zeichen).')
    .optional(),
  wodis_inventory_number: z
    .string()
    .max(120, 'Wodis Inventarnummer darf maximal 120 Zeichen enthalten.')
    .optional(),
  quantity: z
    .number({ invalid_type_error: 'Menge muss eine Zahl sein.' })
    .finite('Menge muss eine Zahl sein.')
    .int('Menge muss eine ganze Zahl sein.')
    .min(1, 'Menge muss mindestens 1 sein.'),
  purchase_date: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Bitte gib ein gültiges Datum an (JJJJ-MM-TT).',
    ),
  value: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val.trim() === '' ||
        (!Number.isNaN(Number(val)) && Number(val) >= 0),
      'Der Wert muss eine positive Zahl sein.',
    ),
  location: z.number().nullable().optional(),
  tags: z.array(z.number()).optional(),
});

type ItemFormSchema = z.infer<typeof itemSchema>;

type StepIndex = 0 | 1 | 2;

const DEFAULT_VALUES: ItemFormSchema = {
  name: '',
  description: '',
  wodis_inventory_number: '',
  quantity: 1,
  purchase_date: '',
  value: '',
  location: null,
  tags: [],
};

const stepFieldMap: (keyof ItemFormSchema)[][] = [
  ['name', 'wodis_inventory_number', 'quantity', 'purchase_date', 'value'],
  ['location', 'tags'],
  [],
];

const AddItemDialog: React.FC<AddItemDialogProps> = ({
  open,
  onClose,
  onCreated,
  onUpdated,
  tags,
  locations,
  onCreateTag,
  onCreateLocation,
  mode = 'create',
  item = null,
}) => {
  const isEditMode = mode === 'edit';
  const {
    control,
    register,
    reset,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ItemFormSchema>({
    resolver: zodResolver(itemSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [tagOptions, setTagOptions] = useState<TagSelectorOption[]>([]);
  const [sortedLocations, setSortedLocations] = useState<Location[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagCreationError, setTagCreationError] = useState<string | null>(null);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [locationCreationError, setLocationCreationError] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const [completedItem, setCompletedItem] = useState<Item | null>(null);
  const [completionMode, setCompletionMode] = useState<'create' | 'edit' | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const watchedValues = watch();
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
      setTagOptions(sortedTags.map((tag) => ({ label: tag.name, value: tag.id })));
      setSortedLocations([...locations].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')));
    }
  }, [open, tags, locations]);

  const resetState = useCallback(
    (sourceItem: Item | null = null) => {
      const initialValues: ItemFormSchema = sourceItem
        ? {
            name: sourceItem?.name ?? '',
            description: sourceItem.description ?? '',
            wodis_inventory_number: sourceItem.wodis_inventory_number ?? '',
            quantity: sourceItem.quantity ?? 1,
            purchase_date: sourceItem.purchase_date ?? '',
            value: sourceItem.value ?? '',
            location: sourceItem.location ?? null,
            tags: sourceItem.tags ?? [],
          }
        : DEFAULT_VALUES;

      reset(initialValues);
    setCurrentStep(0);
    setFormError(null);
    setFiles([]);
    setFileFeedback(null);
    setCompletedItem(null);
    setUploadWarning(null);
    setTagCreationError(null);
    setLocationCreationError(null);
    setNewLocationName('');
      setCompletionMode(null);
    },
    [reset],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialItem = mode === 'edit' ? item ?? null : null;
    resetState(initialItem);

    const focusTimer = window.setTimeout(() => {
      const nameInput = document.getElementById('add-item-name');
      nameInput?.focus();
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open, resetState, mode, item]);

  useEffect(() => {
    if (!open || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const focusTargets: Array<() => HTMLElement | null> = [
      () => document.getElementById('add-item-name'),
      () => document.getElementById('add-item-location'),
      () => reviewSectionRef.current,
    ];

    const target = focusTargets[currentStep]?.();
    if (!target || typeof target.focus !== 'function') {
      return;
    }

    const timer = window.setTimeout(() => {
      target.focus({ preventScroll: true } as FocusOptions);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, open]);

  const determineFileKind = useCallback((file: File): 'image' | 'pdf' | 'file' => {
    const lowerName = file.name.toLowerCase();
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'file';
  }, []);

  const filePreviews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        kind: determineFileKind(file),
      })),
    [determineFileKind, files],
  );

  useEffect(() => {

    return () => {
      filePreviews.forEach((preview) => {
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [filePreviews]);

  const closeDialog = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    const initialItem = mode === 'edit' ? item ?? null : null;
    resetState(initialItem);
    onClose();
  }, [isSubmitting, resetState, mode, item, onClose]);

  const handleRequestClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    const hasUnsavedData = isDirty || files.length > 0 || newLocationName.trim().length > 0;
    if (hasUnsavedData) {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm('Unvollständige Eingaben gehen verloren. Dialog wirklich schließen?');
        if (!confirmed) {
          return;
        }
      } else {
        return;
      }
    }

    closeDialog();
  }, [closeDialog, files.length, isDirty, isSubmitting, newLocationName]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleRequestClose, open]);

  const handleNextStep = useCallback(async () => {
    const fields = stepFieldMap[currentStep];
    if (fields.length > 0) {
      const isValid = await trigger(fields as (keyof ItemFormSchema)[]);
      if (!isValid) {
        return;
      }
    }
    setCurrentStep((prev) => (prev < 2 ? ((prev + 1) as StepIndex) : prev));
  }, [currentStep, trigger]);

  const handlePreviousStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? ((prev - 1) as StepIndex) : prev));
  }, []);

  const handleSelectFiles = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) {
        return;
      }

      const accepted: File[] = [];
      let rejected = false;

      Array.from(selectedFiles).forEach((file) => {
        const lowerName = file.name.toLowerCase();
        const withinSize = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
        const isImage = file.type.startsWith('image/') ||
          ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic', '.heif'].some((ext) => lowerName.endsWith(ext));
        const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

        if ((isImage || isPdf) && withinSize && hasValidExtension) {
          accepted.push(file);
        } else {
          rejected = true;
        }
      });

      if (accepted.length === 0) {
        if (rejected) {
          setFileFeedback(
            `Einige Dateien wurden ignoriert. Erlaubt sind nur Bild- oder PDF-Dateien bis ${MAX_FILE_SIZE_MB} MB.`,
          );
        }
        return;
      }

      setFiles((prev) => {
        const existingNames = new Set(prev.map(f => f.name));
        const newFiles = accepted.filter(f => !existingNames.has(f.name));
        const combined = [...prev, ...newFiles];
        
        if (combined.length > MAX_FILES) {
          setFileFeedback(`Es sind maximal ${MAX_FILES} Dateien erlaubt.`);
          return combined.slice(0, MAX_FILES);
        } else if (rejected) {
          setFileFeedback(
            `Einige Dateien wurden ignoriert. Erlaubt sind nur Bild- oder PDF-Dateien bis ${MAX_FILE_SIZE_MB} MB.`,
          );
        } else {
          setFileFeedback(null);
        }
        return combined;
      });
    },
    [],
  );

  const handleRemoveFile = useCallback((name: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== name));
  }, []);

  const normalisePayload = useCallback((values: ItemFormSchema): ItemPayload => {
    const trimmedName = values.name.trim();
    const trimmedDescription = values.description?.trim() ?? '';
    const trimmedValue = values.value?.trim() ?? '';
    const trimmedPurchaseDate = values.purchase_date?.trim() ?? '';
    const trimmedWodis = values.wodis_inventory_number?.trim() ?? '';

    return {
      name: trimmedName,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      quantity: values.quantity,
      purchase_date: trimmedPurchaseDate.length > 0 ? trimmedPurchaseDate : null,
      value: trimmedValue.length > 0 ? trimmedValue : null,
      location: values.location ?? null,
      wodis_inventory_number: trimmedWodis.length > 0 ? trimmedWodis : null,
      tags: values.tags ?? [],
    };
  }, []);

  const handleCreateTag = useCallback(
    async (name: string): Promise<TagSelectorOption | null> => {
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        return null;
      }

      try {
        setIsCreatingTag(true);
        setTagCreationError(null);
        const newTag = await onCreateTag(trimmed);
        const newOption: TagSelectorOption = { label: newTag.name, value: newTag.id };
        setTagOptions((prev) =>
          [...prev, newOption].sort((a, b) => a.label.localeCompare(b.label, 'de-DE')),
        );
        return newOption;
      } catch (error) {
        setTagCreationError('Tag konnte nicht erstellt werden. Bitte versuche es erneut.');
        return null;
      } finally {
        setIsCreatingTag(false);
      }
    },
    [onCreateTag],
  );

  const handleCreateLocation = useCallback(async () => {
    const trimmed = newLocationName.trim();
    if (trimmed.length === 0) {
      setLocationCreationError('Name des Standorts darf nicht leer sein.');
      return;
    }

    try {
      setIsCreatingLocation(true);
      setLocationCreationError(null);
      const newLocation = await onCreateLocation(trimmed);
      setSortedLocations((prev) =>
        [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name, 'de-DE')),
      );
      reset({
        ...watch(),
        location: newLocation.id,
      });
      setNewLocationName('');
    } catch (error) {
      setLocationCreationError('Standort konnte nicht erstellt werden.');
    } finally {
      setIsCreatingLocation(false);
    }
  }, [newLocationName, onCreateLocation, reset, watch]);

  const submitHandler = useCallback(
    async (values: ItemFormSchema) => {
      setFormError(null);
      setUploadWarning(null);

      try {
        const payload = normalisePayload(values);

        if (mode === 'edit' && item) {
          const updatedItem = await updateItem(item.id, payload);
          const uploadedImages: ItemImage[] = [];
          const failedUploads: string[] = [];

          for (const file of files) {
            try {
              const uploaded = await uploadItemImage(updatedItem.id, file);
              uploadedImages.push(uploaded);
            } catch (error) {
              failedUploads.push(file.name);
            }
          }

          const warningMessage =
            failedUploads.length > 0
              ? `Es konnten ${failedUploads.length} Datei(en) nicht hochgeladen werden: ${failedUploads.join(', ')}.`
              : null;

          const enrichedItem: Item = {
            ...updatedItem,
            images: [...updatedItem.images, ...uploadedImages],
          };

          onUpdated?.(enrichedItem, warningMessage);
          if (warningMessage) {
            setUploadWarning(warningMessage);
          }
          closeDialog();
          return;
        }

        const createdItem = await createItem(payload);
        const uploadedImages: ItemImage[] = [];
        const failedUploads: string[] = [];

        for (const file of files) {
          try {
            const uploaded = await uploadItemImage(createdItem.id, file);
            uploadedImages.push(uploaded);
          } catch (error) {
            failedUploads.push(file.name);
          }
        }

        if (failedUploads.length > 0) {
          setUploadWarning(
            `Der Gegenstand wurde erstellt, jedoch konnten ${failedUploads.length} Bild(er) nicht hochgeladen werden: ${failedUploads.join(', ')}.`,
          );
        }

        const enrichedItem: Item = {
          ...createdItem,
          images: [...createdItem.images, ...uploadedImages],
        };

        onCreated(enrichedItem);
        setCompletedItem(enrichedItem);
        setCompletionMode('create');
      } catch (error) {
        setFormError('Der Gegenstand konnte nicht erstellt werden. Bitte versuche es erneut.');
      }
    },
    [files, normalisePayload, onCreated, onUpdated, mode, item, closeDialog],
  );

  const onSubmit = handleSubmit(submitHandler);

  const handleAddAnother = useCallback(() => {
    resetState(null);
    const nameInput = document.getElementById('add-item-name');
    nameInput?.focus();
  }, [resetState]);

  if (!open) {
    return null;
  }

  const steps = ['Grunddaten', 'Zuordnung', 'Review & Abschluss'];

  if (completedItem && completionMode === 'create') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          className="flex min-h-full items-start justify-center bg-slate-900/40 p-4 sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleRequestClose();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-success-heading"
            className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:rounded-3xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 id="add-item-success-heading" className="text-2xl font-semibold text-slate-900">
                Gegenstand erfolgreich angelegt
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                „{completedItem.name}“ wurde deinem Inventar hinzugefügt.
              </p>
              {uploadWarning && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {uploadWarning}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="primary" size="md" onClick={handleAddAnother}>
                Weiteren Gegenstand anlegen
              </Button>
              <Button variant="secondary" size="md" onClick={closeDialog}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedLocationName =
    (watchedValues.location &&
      sortedLocations.find((location) => location.id === watchedValues.location)?.name) ||
    'Kein Standort';

  const selectedTags = (watchedValues.tags ?? [])
    .map((tagId) => tagOptions.find((option) => option.value === tagId)?.label)
    .filter((label): label is string => Boolean(label));

  const formatCurrency = (value: string | undefined) => {
    if (!value || value.trim().length === 0) {
      return '—';
    }
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return '—';
    }
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
  };

  const formatDate = (value: string | undefined) => {
    if (!value || value.trim().length === 0) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="flex min-h-full items-start justify-center bg-slate-900/40 p-4 sm:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleRequestClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-item-heading"
          className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:rounded-3xl lg:max-w-5xl"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <h3 id="add-item-heading" className="text-xl font-semibold text-slate-900">
                  {isEditMode ? 'Gegenstand bearbeiten' : 'Neuer Gegenstand'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {isEditMode
                    ? 'Aktualisiere Details, Standorte und Dateien in drei strukturierten Schritten.'
                    : 'Erfasse neue Gegenstände in drei Schritten – sauber strukturiert und jederzeit bearbeitbar.'}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleRequestClose} aria-label="Dialog schließen">
                ✕
              </Button>
            </div>
            <nav className="mt-4 grid grid-cols-1 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {steps.map((step, index) => {
                const active = index === currentStep;
                const reached = index <= currentStep;
                return (
                  <div
                    key={step}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                      active
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : reached
                        ? 'border-brand-200 bg-brand-25 text-brand-600'
                        : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                        active || reached
                          ? 'border-brand-400 bg-brand-100 text-brand-700'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                );
              })}
            </nav>
          </header>

          <form className="flex flex-col" onSubmit={onSubmit} noValidate>
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            {currentStep === 0 && (
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-5 lg:max-w-3xl">
                <div className="space-y-2">
                  <label htmlFor="add-item-name" className="text-sm font-medium text-slate-800">
                    Name *
                  </label>
                  <input
                    id="add-item-name"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                    placeholder="z. B. Kamera, Werkzeug, Möbelstück"
                    autoComplete="off"
                    {...register('name')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="add-item-description" className="text-sm font-medium text-slate-800">
                    Beschreibung
                  </label>
                  <textarea
                    id="add-item-description"
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                    placeholder="Optionale Details, Seriennummern oder Zustand..."
                    {...register('description')}
                  />
                  {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="add-item-wodis-inventory-number"
                    className="text-sm font-medium text-slate-800"
                  >
                    Wodis Inventarnummer
                  </label>
                  <input
                    id="add-item-wodis-inventory-number"
                    type="text"
                    inputMode="text"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                    placeholder="z. B. W-12345 oder Projektkennung"
                    {...register('wodis_inventory_number')}
                  />
                  <div className="flex flex-col gap-1 text-xs">
                    {errors.wodis_inventory_number && (
                      <p className="text-red-500">{errors.wodis_inventory_number.message}</p>
                    )}
                    <p className="text-slate-500">
                      Optional – erleichtert die Suche nach Gegenständen in umfangreichen Beständen.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="add-item-quantity" className="text-sm font-medium text-slate-800">
                      Menge *
                    </label>
                    <input
                      id="add-item-quantity"
                      type="number"
                      min={1}
                      step={1}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                      {...register('quantity', { valueAsNumber: true })}
                    />
                    {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="add-item-value" className="text-sm font-medium text-slate-800">
                      Wert (€)
                    </label>
                    <input
                      id="add-item-value"
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                      placeholder="z. B. 249.99"
                      {...register('value')}
                    />
                    {errors.value && <p className="text-xs text-red-500">{errors.value.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="add-item-purchase-date" className="text-sm font-medium text-slate-800">
                    Kaufdatum
                  </label>
                  <input
                    id="add-item-purchase-date"
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                    {...register('purchase_date')}
                  />
                  {errors.purchase_date && <p className="text-xs text-red-500">{errors.purchase_date.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-5 lg:max-w-3xl">
                <div className="space-y-2">
                  <label htmlFor="add-item-location" className="text-sm font-medium text-slate-800">
                    Standort
                  </label>
                  <select
                    id="add-item-location"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                    {...register('location', { 
                      setValueAs: (v) => v === '' ? null : Number(v)
                    })}
                  >
                    <option value="">Kein Standort ausgewählt</option>
                    {sortedLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
                </div>

                <div className="space-y-3 rounded-lg border border-dashed border-slate-200 p-4 lg:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-slate-800">Neuen Standort hinzufügen</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                      <input
                        type="text"
                        value={newLocationName}
                        onChange={(event) => setNewLocationName(event.target.value)}
                        placeholder="z. B. Büro, Keller, Wohnzimmer"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCreateLocation}
                        loading={isCreatingLocation}
                      >
                        Speichern
                      </Button>
                    </div>
                  </div>
                  {locationCreationError && (
                    <p className="text-xs text-red-500">{locationCreationError}</p>
                  )}
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
                        onCreateTag={handleCreateTag}
                        disabled={isSubmitting}
                        isCreating={isCreatingTag}
                      />
                    )}
                  />
                  {tagCreationError && (
                    <p className="text-xs text-red-500">{tagCreationError}</p>
                  )}
                  {errors.tags && <p className="text-xs text-red-500">{errors.tags.message}</p>}
                  {watchedValues.tags && watchedValues.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedTags.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 sm:gap-6 lg:max-w-4xl">
                <section
                  ref={reviewSectionRef}
                  tabIndex={-1}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 lg:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                >
                  <h4 className="text-sm font-semibold uppercase text-slate-500">Zusammenfassung</h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
                      <p className="text-sm font-semibold text-slate-900">{watchedValues.name || '-'}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Wodis Inventarnummer</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {watchedValues.wodis_inventory_number?.trim()
                          ? watchedValues.wodis_inventory_number
                          : '-'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Menge</p>
                      <p className="text-sm font-semibold text-slate-900">{watchedValues.quantity}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Wert</p>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(watchedValues.value)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Kaufdatum</p>
                      <p className="text-sm font-semibold text-slate-900">{formatDate(watchedValues.purchase_date)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Beschreibung</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                        {watchedValues.description?.trim() ? watchedValues.description : '—'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Standort</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedLocationName}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Tags</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedTags.length > 0 ? (
                          selectedTags.map((label) => (
                            <span
                              key={label}
                              className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700"
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">Keine Tags</span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold uppercase text-slate-500">Bilder (optional)</h4>
                      <p className="text-xs text-slate-500">
                        Ziehe Dateien hierher oder wähle sie aus. Maximal {MAX_FILES} Dateien (Bild oder PDF) à {MAX_FILE_SIZE_MB} MB.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="add-item-images"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-100"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
                        </svg>
                        Dateien auswählen
                      </label>
                      <input
                        id="add-item-images"
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        hidden
                        onChange={(event) => handleSelectFiles(event.target.files)}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-4 flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500"
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleSelectFiles(event.dataTransfer.files);
                    }}
                  >
                    {files.length === 0 ? (
                      <p className="text-center text-sm text-slate-500">Hierhin ziehen oder oben auf „Dateien auswählen“ klicken.</p>
                    ) : (
                      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filePreviews.map((preview) => (
                          <div
                            key={preview.url}
                            className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                          >
                            {preview.kind === 'image' ? (
                              <img src={preview.url} alt={preview.name} className="h-36 w-full object-cover" />
                            ) : (
                              <div className="flex h-36 w-full flex-col items-center justify-center bg-slate-100 text-slate-600">
                                <svg
                                  className="h-10 w-10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5"
                                  />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h6" />
                                </svg>
                                <span className="mt-2 text-xs font-semibold uppercase">
                                  {preview.kind === 'pdf' ? 'PDF' : 'DATEI'}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                              <span className="truncate pr-2" title={preview.name}>
                                {preview.name}
                              </span>
                              <button
                                type="button"
                                className="text-red-500 transition hover:text-red-600"
                                onClick={() => handleRemoveFile(preview.name)}
                              >
                                Entfernen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {fileFeedback && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      {fileFeedback}
                    </div>
                  )}
              </section>
              </div>
            )}
            </div>
            <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Schritt {currentStep + 1} von {steps.length}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {currentStep > 0 && (
                    <Button type="button" variant="secondary" size="md" onClick={handlePreviousStep}>
                      Zurück
                    </Button>
                  )}
                  {currentStep < 2 && (
                    <Button type="button" variant="primary" size="md" onClick={handleNextStep}>
                      Weiter
                    </Button>
                  )}
                  {currentStep === 2 && (
                    <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
                      {isEditMode ? 'Änderungen speichern' : 'Gegenstand anlegen'}
                    </Button>
                  )}
                </div>
              </div>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddItemDialog;
