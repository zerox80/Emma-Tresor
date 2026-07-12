import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Button from "./common/Button";
import AddItemDialogLayout from "./AddItemDialogLayout";
import AddItemSuccess from "./AddItemSuccess";
import type { TagSelectorOption } from "./TagSelector";
import {
  AddItemAssignmentStep,
  AddItemBasicsStep,
  AddItemReviewStep,
} from "./AddItemSteps";
import {
  DEFAULT_VALUES,
  STEP_FIELD_MAP,
  formatItemFormCurrency,
  formatItemFormDate,
  itemSchema,
  normaliseItemPayload,
  type ItemFormSchema,
  type StepIndex,
} from "./addItemForm";
import { useItemFiles } from "./useItemFiles";
import { createItem, updateItem, uploadItemImage } from "../api/inventory";
import type {
  Item,
  ItemImage,
  Location,
  Tag,
} from "../types/inventory";

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: Item) => void;
  tags: Tag[];
  locations: Location[];
  onCreateTag: (name: string) => Promise<Tag>;
  onCreateLocation: (name: string) => Promise<Location>;
  mode?: "create" | "edit";
  item?: Item | null;
  onUpdated?: (item: Item, warning?: string | null) => void;
}

const AddItemDialog: React.FC<AddItemDialogProps> = ({
  open,
  onClose,
  onCreated,
  onUpdated,
  tags,
  locations,
  onCreateTag,
  onCreateLocation,
  mode = "create",
  item = null,
}) => {
  const isEditMode = mode === "edit";
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
  const [locationCreationError, setLocationCreationError] = useState<
    string | null
  >(null);
  const [newLocationName, setNewLocationName] = useState("");
  const {
    files,
    fileFeedback,
    filePreviews,
    handleRemoveFile,
    handleSelectFiles,
    resetFiles,
  } = useItemFiles();
  const [completedItem, setCompletedItem] = useState<Item | null>(null);
  const [completionMode, setCompletionMode] = useState<
    "create" | "edit" | null
  >(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const watchedValues = watch();
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      const sortedTags = [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, "de-DE"),
      );
      setTagOptions(
        sortedTags.map((tag) => ({ label: tag.name, value: tag.id })),
      );
      setSortedLocations(
        [...locations].sort((a, b) => a.name.localeCompare(b.name, "de-DE")),
      );
    }
  }, [open, tags, locations]);

  const resetState = useCallback(
    (sourceItem: Item | null = null) => {
      const initialValues: ItemFormSchema = sourceItem
        ? {
            name: sourceItem?.name ?? "",
            description: sourceItem.description ?? "",
            wodis_inventory_number: sourceItem.wodis_inventory_number ?? "",
            quantity: sourceItem.quantity ?? 1,
            purchase_date: sourceItem.purchase_date ?? "",
            value: sourceItem.value ?? "",
            location: sourceItem.location ?? null,
            tags: sourceItem.tags ?? [],
            employee_name: sourceItem.employee_name ?? "",
            room_number: sourceItem.room_number ?? "",
          }
        : DEFAULT_VALUES;

      reset(initialValues);
      setCurrentStep(0);
      setFormError(null);
      resetFiles();
      setCompletedItem(null);
      setUploadWarning(null);
      setTagCreationError(null);
      setLocationCreationError(null);
      setNewLocationName("");
      setCompletionMode(null);
    },
    [reset, resetFiles],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialItem = mode === "edit" ? (item ?? null) : null;
    resetState(initialItem);

    const focusTimer = window.setTimeout(() => {
      const nameInput = document.getElementById("add-item-name");
      nameInput?.focus();
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open, resetState, mode, item]);

  useEffect(() => {
    if (
      !open ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const focusTargets: Array<() => HTMLElement | null> = [
      () => document.getElementById("add-item-name"),
      () => document.getElementById("add-item-location"),
      () => reviewSectionRef.current,
    ];

    const target = focusTargets[currentStep]?.();
    if (!target || typeof target.focus !== "function") {
      return;
    }

    const timer = window.setTimeout(() => {
      target.focus({ preventScroll: true } as FocusOptions);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, open]);

  const closeDialog = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    const initialItem = mode === "edit" ? (item ?? null) : null;
    resetState(initialItem);
    onClose();
  }, [isSubmitting, resetState, mode, item, onClose]);

  const handleRequestClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    const hasUnsavedData =
      isDirty || files.length > 0 || newLocationName.trim().length > 0;
    if (hasUnsavedData) {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(
          "Unvollständige Eingaben gehen verloren. Dialog wirklich schließen?",
        );
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
    if (!open || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleRequestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleRequestClose, open]);

  const handleNextStep = useCallback(async () => {
    const fields = STEP_FIELD_MAP[currentStep];
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
        const newOption: TagSelectorOption = {
          label: newTag.name,
          value: newTag.id,
        };
        setTagOptions((prev) =>
          [...prev, newOption].sort((a, b) =>
            a.label.localeCompare(b.label, "de-DE"),
          ),
        );
        return newOption;
      } catch (error) {
        setTagCreationError(
          "Tag konnte nicht erstellt werden. Bitte versuche es erneut.",
        );
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
      setLocationCreationError("Name des Standorts darf nicht leer sein.");
      return;
    }

    try {
      setIsCreatingLocation(true);
      setLocationCreationError(null);
      const newLocation = await onCreateLocation(trimmed);
      setSortedLocations((prev) =>
        [...prev, newLocation].sort((a, b) =>
          a.name.localeCompare(b.name, "de-DE"),
        ),
      );
      reset({
        ...watch(),
        location: newLocation.id,
      });
      setNewLocationName("");
    } catch (error) {
      setLocationCreationError("Standort konnte nicht erstellt werden.");
    } finally {
      setIsCreatingLocation(false);
    }
  }, [newLocationName, onCreateLocation, reset, watch]);

  const submitHandler = useCallback(
    async (values: ItemFormSchema) => {
      setFormError(null);
      setUploadWarning(null);

      try {
        const payload = normaliseItemPayload(values);

        if (mode === "edit" && item) {
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
              ? `Es konnten ${failedUploads.length} Datei(en) nicht hochgeladen werden: ${failedUploads.join(", ")}.`
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
            "Der Gegenstand wurde erstellt, jedoch konnten " +
              `${failedUploads.length} Bild(er) nicht hochgeladen werden: ` +
              `${failedUploads.join(", ")}.`,
          );
        }

        const enrichedItem: Item = {
          ...createdItem,
          images: [...createdItem.images, ...uploadedImages],
        };

        onCreated(enrichedItem);
        setCompletedItem(enrichedItem);
        setCompletionMode("create");
      } catch (error) {
        setFormError(
          "Der Gegenstand konnte nicht erstellt werden. Bitte versuche es erneut.",
        );
      }
    },
    [files, onCreated, onUpdated, mode, item, closeDialog],
  );

  const onSubmit = handleSubmit(submitHandler);

  const handleAddAnother = useCallback(() => {
    resetState(null);
    const nameInput = document.getElementById("add-item-name");
    nameInput?.focus();
  }, [resetState]);

  if (!open) {
    return null;
  }

  const steps = ["Grunddaten", "Zuordnung", "Review & Abschluss"];

  if (completedItem && completionMode === "create") {
    return (
      <AddItemSuccess
        item={completedItem}
        uploadWarning={uploadWarning}
        onAddAnother={handleAddAnother}
        onClose={closeDialog}
        onRequestClose={handleRequestClose}
      />
    );
  }

  const selectedLocationName =
    (watchedValues.location &&
      sortedLocations.find((location) => location.id === watchedValues.location)
        ?.name) ||
    "Kein Standort";

  const selectedTags = (watchedValues.tags ?? [])
    .map((tagId) => tagOptions.find((option) => option.value === tagId)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <AddItemDialogLayout
      isEditMode={isEditMode}
      currentStep={currentStep}
      steps={steps}
      formError={formError}
      isSubmitting={isSubmitting}
      onRequestClose={handleRequestClose}
      onSubmit={onSubmit}
      onPreviousStep={handlePreviousStep}
      onNextStep={handleNextStep}
    >
      {currentStep === 0 && <AddItemBasicsStep register={register} errors={errors} />}
      {currentStep === 1 && (
        <AddItemAssignmentStep
          register={register}
          errors={errors}
          control={control}
          locations={sortedLocations}
          tagOptions={tagOptions}
          selectedTags={selectedTags}
          selectedTagIds={watchedValues.tags ?? []}
          isSubmitting={isSubmitting}
          isCreatingTag={isCreatingTag}
          tagCreationError={tagCreationError}
          onCreateTag={handleCreateTag}
          newLocationName={newLocationName}
          setNewLocationName={setNewLocationName}
          onCreateLocation={handleCreateLocation}
          isCreatingLocation={isCreatingLocation}
          locationCreationError={locationCreationError}
        />
      )}
      {currentStep === 2 && (
        <AddItemReviewStep
          values={watchedValues}
          selectedLocationName={selectedLocationName}
          selectedTags={selectedTags}
          filePreviews={filePreviews}
          fileFeedback={fileFeedback}
          reviewSectionRef={reviewSectionRef}
          onSelectFiles={handleSelectFiles}
          onRemoveFile={handleRemoveFile}
          formatCurrency={formatItemFormCurrency}
          formatDate={formatItemFormDate}
        />
      )}
    </AddItemDialogLayout>
  );
};

export default AddItemDialog;
