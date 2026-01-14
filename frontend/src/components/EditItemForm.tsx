import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Button from './common/Button';
import { updateItem } from '../api/inventory';
import type { Item, ItemPayload, Location, Tag } from '../types/inventory';

const itemSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().nullable().optional(),
  wodis_inventory_number: z
    .string()
    .max(120, 'Wodis Inventarnummer darf maximal 120 Zeichen enthalten.')
    .optional(),
  quantity: z
    .number()
    .int('Menge muss eine ganze Zahl sein')
    .min(1, 'Menge muss mindestens 1 sein'),
  purchase_date: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  location: z.number().nullable().optional(),
  tags: z.array(z.number()).optional(),
  employee_name: z
    .string()
    .max(255, 'Mitarbeiter Name darf maximal 255 Zeichen enthalten.')
    .optional(),
  room_number: z
    .string()
    .max(50, 'Raum Nr darf maximal 50 Zeichen enthalten.')
    .optional(),
});

type ItemFormSchema = z.infer<typeof itemSchema>;

interface EditItemFormProps {

  item: Item;

  locations: Location[];

  tags: Tag[];

  onSuccess: () => void;

  onCancel: () => void;
}

const EditItemForm: React.FC<EditItemFormProps> = ({ item, locations, tags, onSuccess, onCancel }) => {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormSchema>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item.name,
      description: item.description || '',
      wodis_inventory_number: item.wodis_inventory_number || '',
      quantity: item.quantity,
      purchase_date: item.purchase_date || '',
      value: item.value || '',
      location: item.location || undefined,
      tags: item.tags || [],
      employee_name: item.employee_name || '',
      room_number: item.room_number || '',
    },
  });

  const watchedTags = watch('tags') || [];

  const normalisePayload = (values: ItemFormSchema): ItemPayload => {
    const description = values.description?.trim();
    const purchaseDate = values.purchase_date?.trim();
    const rawValue = values.value;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? null : String(rawValue);
    const wodis = values.wodis_inventory_number?.trim() ?? '';
    const employeeName = values.employee_name?.trim() ?? '';
    const roomNumber = values.room_number?.trim() ?? '';

    return {
      name: values.name.trim(),
      description: description && description.length > 0 ? description : null,
      quantity: values.quantity,
      purchase_date: purchaseDate && purchaseDate.length > 0 ? purchaseDate : null,
      value,
      location: typeof values.location === 'number' && !Number.isNaN(values.location) ? values.location : null,
      wodis_inventory_number: wodis.length > 0 ? wodis : null,
      tags: values.tags ?? [],
      employee_name: employeeName.length > 0 ? employeeName : null,
      room_number: roomNumber.length > 0 ? roomNumber : null,
    };
  };

  const onSubmit = async (values: ItemFormSchema) => {
    setFormError(null);

    try {
      const itemData = normalisePayload(values);
      await updateItem(item.id, itemData);
      onSuccess();
    } catch (error) {
      setFormError('Der Gegenstand konnte nicht aktualisiert werden. Bitte versuche es erneut.');
    }
  };

  const handleTagToggle = (tagId: number) => {
    const currentTags = watchedTags;
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];
    setValue('tags', newTags);
  };

  return (
    <form className="flex h-full flex-col text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-grow overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <label htmlFor="name" className="text-sm font-medium text-slate-800">
              Name *
            </label>
            <input
              id="name"
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="z. B. Laptop, Buch, Werkzeug..."
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="description" className="text-sm font-medium text-slate-800">
              Beschreibung
            </label>
            <textarea
              id="description"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="Optionale Beschreibung des Gegenstands..."
              {...register('description')}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="wodis_inventory_number" className="text-sm font-medium text-slate-800">
              Wodis Inventarnummer
            </label>
            <input
              id="wodis_inventory_number"
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              placeholder="Optional – z. B. W-12345"
              {...register('wodis_inventory_number')}
            />
            <div className="flex flex-col gap-1 text-xs">
              {errors.wodis_inventory_number && (
                <p className="text-red-500">{errors.wodis_inventory_number.message}</p>
              )}
              <p className="text-slate-500">
                Wird in der Suche angezeigt. Leer lassen, falls nicht vorhanden.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label htmlFor="quantity" className="text-sm font-medium text-slate-800">
                Menge *
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                placeholder="z. B. 1299.99"
                {...register('value')}
              />
              {errors.value && <p className="text-xs text-red-500">{errors.value.message}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="purchase_date" className="text-sm font-medium text-slate-800">
              Kaufdatum
            </label>
            <input
              id="purchase_date"
              type="date"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              {...register('purchase_date')}
            />
            {errors.purchase_date && <p className="text-xs text-red-500">{errors.purchase_date.message}</p>}
          </div>

          <div className="space-y-3">
            <label htmlFor="location" className="text-sm font-medium text-slate-800">
              Standort
            </label>
            <select
              id="location"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
              {...register('location', { valueAsNumber: true })}
            >
              <option value="">Kein Standort ausgewählt</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${watchedTags.includes(tag.id)
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            {errors.tags && <p className="text-xs text-red-500">{errors.tags.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label htmlFor="employee_name" className="text-sm font-medium text-slate-800">
                Mitarbeiter Name
              </label>
              <input
                id="employee_name"
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                placeholder="z. B. Max Mustermann"
                {...register('employee_name')}
              />
              {errors.employee_name && <p className="text-xs text-red-500">{errors.employee_name.message}</p>}
              <p className="text-xs text-slate-500">
                Optional – welchem Mitarbeiter ist der Gegenstand zugeordnet?
              </p>
            </div>

            <div className="space-y-3">
              <label htmlFor="room_number" className="text-sm font-medium text-slate-800">
                Raum Nr
              </label>
              <input
                id="room_number"
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
                placeholder="z. B. 101, A2.15"
                {...register('room_number')}
              />
              {errors.room_number && <p className="text-xs text-red-500">{errors.room_number.message}</p>}
              <p className="text-xs text-slate-500">
                Optional – in welchem Raum befindet sich der Gegenstand?
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-2xl gap-3 sm:justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="flex-1 sm:flex-none">
            Änderungen speichern
          </Button>
        </div>
      </div>
    </form>
  );
}

export default EditItemForm;
