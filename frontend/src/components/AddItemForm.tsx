import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Select, { type MultiValue, type OnChangeValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';

import Button from './common/Button';
import { createItem, createTag, createLocation, fetchLocations } from '../api/inventory';
import type { ItemPayload, Location, Tag } from '../types/inventory';

const itemSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  quantity: z
    .number()
    .int('Menge muss eine ganze Zahl sein')
    .min(1, 'Menge muss mindestens 1 sein'),
  purchase_date: z.string().optional().or(z.literal('')),
  value: z.string().optional().or(z.literal('')),
  location: z.number().optional().nullable(),
  tags: z.array(z.number()).optional(),
});

type ItemFormSchema = z.infer<typeof itemSchema>;

interface SelectOption {
  value: number;
  label: string;
}

interface AddItemFormProps {
  locations: Location[];
  tags: Tag[];
  onSuccess: () => void;
  onCancel: () => void;
}

const AddItemForm: React.FC<AddItemFormProps> = ({ locations, tags, onSuccess, onCancel }) => {
  const [formError, setFormError] = useState<string | null>(null);
  const [availableLocations, setAvailableLocations] = useState<Location[]>(locations);
  const [availableTags, setAvailableTags] = useState<Tag[]>(tags);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  useEffect(() => {
    setAvailableLocations(locations);
    setAvailableTags(tags);
  }, [locations, tags]);

  useEffect(() => {
    if (locations.length > 0) {
      return;
    }

    let isMounted = true;
    const loadLocations = async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const response = await fetchLocations();
        if (isMounted) {
          setAvailableLocations(response);
        }
      } catch (error) {
        console.error('Failed to load locations for AddItemForm', error);
        if (isMounted) {
          setLocationsError('Standorte konnten nicht geladen werden. Aktualisiere die Seite oder versuche es erneut.');
        }
      } finally {
        if (isMounted) {
          setLocationsLoading(false);
        }
      }
    };

    void loadLocations();

    return () => {
      isMounted = false;
    };
  }, [locations.length]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormSchema>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      description: undefined,
      quantity: 1,
      purchase_date: undefined,
      value: undefined,
      location: undefined,
      tags: [],
    },
  });

  const watchedTags = watch('tags') || [];

  const normalisePayload = (values: ItemFormSchema): ItemPayload => {
    const description = values.description?.trim();
    const purchaseDate = values.purchase_date?.trim();
    const rawValue = values.value;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? null : String(rawValue);

    return {
      name: values.name.trim(),
      description: description && description.length > 0 ? description : '',
      quantity: values.quantity,
      purchase_date: purchaseDate && purchaseDate.length > 0 ? purchaseDate : null,
      value: value,
      location: Number.isFinite(values.location) ? values.location ?? null : null,
      tags: values.tags ?? [],
    };
  };

  const onSubmit = async (values: ItemFormSchema) => {
    setFormError(null);

    try {
      const itemData = normalisePayload(values);
      await createItem(itemData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create item:', error);
      setFormError('Der Gegenstand konnte nicht erstellt werden. Bitte versuche es erneut.');
    }
  };

  const handleTagToggle = (tagId: number) => {
    const currentTags = watchedTags;
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];
    setValue('tags', newTags);
  };

  const handleCreateLocation = async (inputValue: string) => {
    setIsCreatingLocation(true);
    try {
      const newLocation = await createLocation(inputValue.trim());
      setAvailableLocations(prev => [...prev, newLocation]);
      setValue('location', newLocation.id);
      return newLocation.id;
    } catch (error) {
      console.error('Failed to create location:', error);
      setFormError('Standort konnte nicht erstellt werden. Bitte versuche es erneut.');
      throw error;
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const handleCreateTag = async (inputValue: string) => {
    setIsCreatingTag(true);
    try {
      const newTag = await createTag(inputValue.trim());
      setAvailableTags(prev => [...prev, newTag]);
      const currentTags = watchedTags || [];
      setValue('tags', [...currentTags, newTag.id]);
      return newTag.id;
    } catch (error) {
      console.error('Failed to create tag:', error);
      setFormError('Tag konnte nicht erstellt werden. Bitte versuche es erneut.');
      throw error;
    } finally {
      setIsCreatingTag(false);
    }
  };

  const locationOptions = availableLocations.map(loc => ({ value: loc.id, label: loc.name }));
  const tagOptions = availableTags.map(tag => ({ value: tag.id, label: tag.name }));
  
  const selectedLocationOption = locationOptions.find(opt => opt.value === watch('location')) || null;
  const selectedTagOptions = tagOptions.filter(opt => watchedTags.includes(opt.value));

  return (
    <form className="flex h-full min-h-0 flex-1 flex-col text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-5 sm:py-4">
        <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-col gap-3">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-800">
              Name *
            </label>
            <input
              id="name"
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="z. B. Laptop, Buch, Werkzeug..."
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-3 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-800">
              Beschreibung
            </label>
            <textarea
              id="description"
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="Optionale Beschreibung des Gegenstands..."
              {...register('description')}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="quantity" className="text-sm font-medium text-slate-800">
              Menge *
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              step="1"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="value" className="text-sm font-medium text-slate-800">
              Wert (€)
            </label>
            <input
              id="value"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="z. B. 1299.99"
              {...register('value')}
            />
            {errors.value && <p className="text-xs text-red-500">{errors.value.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="purchase_date" className="text-sm font-medium text-slate-800">
              Kaufdatum
            </label>
            <input
              id="purchase_date"
              type="date"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              {...register('purchase_date')}
            />
            {errors.purchase_date && <p className="text-xs text-red-500">{errors.purchase_date.message}</p>}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800">Standort</label>
            <CreatableSelect
              isClearable
              isDisabled={isCreatingLocation}
              isLoading={locationsLoading || isCreatingLocation}
              onCreateOption={handleCreateLocation}
              options={locationOptions}
              value={selectedLocationOption}
              onChange={(newValue) => {
                setValue('location', newValue?.value ?? null);
              }}
              placeholder="Standort auswählen oder erstellen..."
              formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
              noOptionsMessage={() => "Keine Standorte gefunden"}
              loadingMessage={() => "Lade..."}
              className="react-select-container"
              classNamePrefix="react-select"
            />
            {locationsError && <p className="text-xs text-red-500">{locationsError}</p>}
            {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
          </div>

          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-medium text-slate-800">Tags</label>
            <Select
              isMulti
              isClearable
              isDisabled={isCreatingTag}
              isLoading={isCreatingTag}
              options={tagOptions}
              value={selectedTagOptions}
              onChange={(newValue) => {
                const values = (newValue as SelectOption[]).map(option => option.value);
                setValue('tags', values);
              }}
              placeholder="Tags auswählen..."
              noOptionsMessage={() => "Keine Tags gefunden"}
              loadingMessage={() => "Lade..."}
              className="react-select-container"
              classNamePrefix="react-select"
            />
            <CreatableSelect
              isClearable
              isDisabled={isCreatingTag}
              isLoading={isCreatingTag}
              onCreateOption={async (inputValue: string) => {
                await handleCreateTag(inputValue);
              }}
              options={[]}
              value={null}
              onChange={() => {}}
              placeholder="Neuen Tag erstellen..."
              formatCreateLabel={(inputValue: string) => `"${inputValue}" als Tag erstellen`}
              noOptionsMessage={() => "Tag eingeben zum Erstellen"}
              loadingMessage={() => "Erstelle Tag..."}
              className="react-select-container"
              classNamePrefix="react-select"
            />
            {errors.tags && <p className="text-xs text-red-500">{errors.tags.message}</p>}
          </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onCancel} className="sm:w-auto">
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            className="sm:min-w-[12rem]"
          >
            Gegenstand hinzufügen
          </Button>
        </div>
      </div>
    </form>
  );
}

export default AddItemForm;
