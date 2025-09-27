import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Select, { type MultiValue } from 'react-select';
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

  useEffect(() => {
    register('location');
    register('tags');
  }, [register]);

  const watchedTags = watch('tags') || [];
  const watchedLocation = watch('location');

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
      value,
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

  const selectedLocationOption = locationOptions.find(option => option.value === watchedLocation) || null;
  const selectedTagOptions = tagOptions.filter(option => watchedTags.includes(option.value));

  return (
    <form className="flex h-full flex-col text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-shrink-0 border-b border-slate-200 px-6 py-5">
        <h3 id="add-item-heading" className="text-xl font-semibold text-slate-900">
          Neuen Gegenstand hinzufügen
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Erstelle einen neuen Inventargegenstand und weise ihm optionale Tags und Standorte zu.
        </p>
      </div>

      <div className="flex-grow overflow-y-auto p-8">
        {formError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
          <div className="space-y-3 lg:col-span-2">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-800">
                Name *
              </label>
              <input
                id="name"
                type="text"
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="z. B. Laptop, Buch, Werkzeug"
                {...register('name')}
              />
              {errors.name && <p className="mt-1 text-xs font-medium text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-800">
                Beschreibung
              </label>
              <textarea
                id="description"
                rows={4}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="Optionale Beschreibung des Gegenstands"
                {...register('description')}
              />
              {errors.description && <p className="mt-1 text-xs font-medium text-red-600">{errors.description.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-semibold text-slate-800">
              Menge *
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              step="1"
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && <p className="mt-1 text-xs font-medium text-red-600">{errors.quantity.message}</p>}
          </div>

          <div>
            <label htmlFor="value" className="block text-sm font-semibold text-slate-800">
              Wert
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">
                €
              </span>
              <input
                id="value"
                type="number"
                step="0.01"
                min="0"
                className="block w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="z. B. 1299,99"
                {...register('value')}
              />
            </div>
            {errors.value && <p className="mt-1 text-xs font-medium text-red-600">{errors.value.message}</p>}
          </div>

          <div>
            <label htmlFor="purchase_date" className="block text-sm font-semibold text-slate-800">
              Kaufdatum
            </label>
            <input
              id="purchase_date"
              type="date"
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              {...register('purchase_date')}
            />
            {errors.purchase_date && <p className="mt-1 text-xs font-medium text-red-600">{errors.purchase_date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">Standort</label>
            <div className="mt-2">
              <CreatableSelect
                isClearable
                isDisabled={isCreatingLocation}
                isLoading={locationsLoading || isCreatingLocation}
                onCreateOption={handleCreateLocation}
                options={locationOptions}
                value={selectedLocationOption}
                onChange={(newValue) => {
                  setValue('location', newValue?.value ?? null, { shouldDirty: true, shouldValidate: true });
                }}
                placeholder="Standort auswählen …"
                formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
                noOptionsMessage={() => 'Keine Standorte gefunden'}
                loadingMessage={() => 'Lade…'}
                className="react-select-container text-sm"
                classNamePrefix="react-select"
              />
            </div>
            {locationsError && <p className="mt-1 text-xs font-medium text-red-600">{locationsError}</p>}
            {errors.location && <p className="mt-1 text-xs font-medium text-red-600">{errors.location.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">Tags</label>
            <div className="mt-2 space-y-3">
              <Select
                isMulti
                isClearable
                isDisabled={isCreatingTag}
                isLoading={isCreatingTag}
                options={tagOptions}
                value={selectedTagOptions}
                onChange={(newValue) => {
                  const values = (newValue as MultiValue<SelectOption>).map((option) => option.value);
                  setValue('tags', values, { shouldDirty: true, shouldValidate: true });
                }}
                placeholder="Tags auswählen …"
                noOptionsMessage={() => 'Keine Tags gefunden'}
                loadingMessage={() => 'Lade…'}
                className="react-select-container text-sm"
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
                placeholder="Neuen Tag erstellen …"
                formatCreateLabel={(inputValue) => `"${inputValue}" als Tag erstellen`}
                noOptionsMessage={() => 'Tag eingeben zum Erstellen'}
                loadingMessage={() => 'Erstelle Tag…'}
                className="react-select-container text-sm"
                classNamePrefix="react-select"
              />
            </div>
            {errors.tags && <p className="mt-1 text-xs font-medium text-red-600">{errors.tags.message}</p>}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-white/70 px-6 py-4 backdrop-blur-sm">
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="min-w-[12rem]">
            Gegenstand speichern
          </Button>
        </div>
      </div>
    </form>
  );
}

export default AddItemForm;
