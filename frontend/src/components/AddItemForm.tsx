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
    <form className="flex h-full min-h-0 flex-1 flex-col text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {formError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {formError}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-6">
          {/* Linke Spalte - Hauptbereich (2/3 der Breite) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <label htmlFor="name" className="block text-base font-semibold text-slate-800">
                Name *
              </label>
              <input
                id="name"
                type="text"
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50 bg-slate-50 p-3 text-base"
                placeholder="z. B. Laptop, Buch, Werkzeug..."
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-4">
              <label htmlFor="description" className="block text-base font-semibold text-slate-800">
                Beschreibung
              </label>
              <textarea
                id="description"
                rows={5}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50 bg-slate-50 p-3 text-base"
                placeholder="Optionale Beschreibung des Gegenstands..."
                {...register('description')}
              />
              {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
            </div>

            {/* Bilder-Upload Bereich */}
            <div className="space-y-4">
              <label className="block text-base font-semibold text-slate-800">
                Bilder
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="space-y-3">
                  <div className="mx-auto h-12 w-12 text-slate-400">
                    <svg className="h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Bilder hierher ziehen oder klicken zum Auswählen</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF bis zu 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rechte Spalte - Seitenleiste (1/3 der Breite) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status Gruppe */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b pb-2 mb-4">Status</h3>
              
              <div className="space-y-3">
                <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
                  Menge *
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50 bg-slate-50 p-3"
                  {...register('quantity', { valueAsNumber: true })}
                />
                {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity.message}</p>}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Standort</label>
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
                  placeholder="Standort auswählen..."
                  formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
                  noOptionsMessage={() => "Keine Standorte gefunden"}
                  loadingMessage={() => "Lade..."}
                  className="react-select-container text-sm"
                  classNamePrefix="react-select"
                />
                {locationsError && <p className="text-xs text-red-600 mt-1">{locationsError}</p>}
                {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location.message}</p>}
              </div>
            </div>

            {/* Kaufdetails Gruppe */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b pb-2 mb-4">Kaufdetails</h3>
              
              <div className="space-y-3">
                <label htmlFor="value" className="block text-sm font-medium text-slate-700">
                  Wert (€)
                </label>
                <input
                  id="value"
                  type="number"
                  step="0.01"
                  min="0"
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50 bg-slate-50 p-3"
                  placeholder="z. B. 1299.99"
                  {...register('value')}
                />
                {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value.message}</p>}
              </div>

              <div className="space-y-3">
                <label htmlFor="purchase_date" className="block text-sm font-medium text-slate-700">
                  Kaufdatum
                </label>
                <input
                  id="purchase_date"
                  type="date"
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50 bg-slate-50 p-3"
                  {...register('purchase_date')}
                />
                {errors.purchase_date && <p className="text-xs text-red-600 mt-1">{errors.purchase_date.message}</p>}
              </div>
            </div>

            {/* Kategorisierung Gruppe */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b pb-2 mb-4">Kategorisierung</h3>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Tags</label>
                <Select
                  isMulti
                  isClearable
                  isDisabled={isCreatingTag}
                  isLoading={isCreatingTag}
                  options={tagOptions}
                  value={selectedTagOptions}
                  onChange={(newValue) => {
                    const values = (newValue as MultiValue<SelectOption>).map(option => option.value);
                    setValue('tags', values, { shouldDirty: true, shouldValidate: true });
                  }}
                  placeholder="Tags auswählen..."
                  noOptionsMessage={() => "Keine Tags gefunden"}
                  loadingMessage={() => "Lade..."}
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
                  placeholder="Neuen Tag erstellen..."
                  formatCreateLabel={(inputValue) => `"${inputValue}" als Tag erstellen`}
                  noOptionsMessage={() => "Tag eingeben zum Erstellen"}
                  loadingMessage={() => "Erstelle Tag..."}
                  className="react-select-container text-sm"
                  classNamePrefix="react-select"
                />
                {errors.tags && <p className="text-xs text-red-600 mt-1">{errors.tags.message}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixierter Footer */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 px-6 py-4 flex justify-end gap-3 mt-8">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting}
          className="min-w-[12rem]"
        >
          Gegenstand hinzufügen
        </Button>
      </div>
    </form>
  );
};

export default AddItemForm;
