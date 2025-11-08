import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import Button from '../components/common/Button';
import {
  createLocation,
  createTag,
  deleteLocation,
  deleteTag,
  fetchLocations,
  fetchTags,
} from '../api/inventory';
import type { Location, Tag } from '../types/inventory';

/**
 * Zod schema for validating names of tags and locations.
 * - Minimum 2 characters.
 * - Maximum 60 characters.
 * - Allows letters (including Unicode), numbers, spaces, hyphens, underscores, and periods.
 */
const nameSchema = z
  .string()
  .min(2, 'Mindestens 2 Zeichen erforderlich')
  .max(60, 'Maximal 60 Zeichen erlaubt')
  .regex(/^[\p{L}0-9\s\-_.]+$/u, 'Nur Buchstaben, Zahlen und - _ . erlaubt');

/**
 * Extracts a user-friendly error message from an API error response (e.g., AxiosError).
 * It attempts to find a 'detail' field, or the first string/array of strings in the response data.
 *
 * @param {unknown} error - The raw error object, potentially an AxiosError.
 * @param {string} fallback - A fallback message to return if no specific error detail can be extracted.
 * @returns {string} The extracted error message or the fallback message.
 */
const extractApiError = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;

      const detail = record.detail;
      if (typeof detail === 'string') {
        return detail;
      }

      for (const value of Object.values(record)) {
        if (typeof value === 'string') {
          return value;
        }
        if (Array.isArray(value)) {
          const message = value.find((entry): entry is string => typeof entry === 'string');
          if (message) {
            return message;
          }
        }
      }
    }
  }

  return fallback;
};

/**
 * The settings page component, allowing users to manage their custom tags and locations.
 * Users can create new tags and locations, and delete existing ones.
 * The component handles input validation, API interactions, and displays feedback messages.
 *
 * @returns {JSX.Element} The rendered settings page.
 */
const SettingsPage: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tagName, setTagName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [tagInfo, setTagInfo] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<string | null>(null);

  /**
   * Effect hook to load initial tags and locations data from the API on component mount.
   * Handles loading and error states for the initial fetch.
   */
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setInitialError(null);
      try {
        const [tagResponse, locationResponse] = await Promise.all([fetchTags(), fetchLocations()]);
        if (isMounted) {
          setTags(tagResponse);
          setLocations(locationResponse);
        }
      } catch (error) {
        if (isMounted) {
          setInitialError('Tags und Standorte konnten nicht geladen werden. Bitte aktualisiere die Seite oder versuche es erneut.');
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Effect hook to automatically clear the `tagInfo` message after a delay.
   */
  useEffect(() => {
    if (!tagInfo) {
      return;
    }
    const timer = window.setTimeout(() => setTagInfo(null), 4000);
    return () => window.clearTimeout(timer);
  }, [tagInfo]);

  /**
   * Effect hook to automatically clear the `locationInfo` message after a delay.
   */
  useEffect(() => {
    if (!locationInfo) {
      return;
    }
    const timer = window.setTimeout(() => setLocationInfo(null), 4000);
    return () => window.clearTimeout(timer);
  }, [locationInfo]);

  /**
   * Handles the creation of a new tag.
   * Validates the tag name, calls the API, and updates the tags state.
   */
  const handleCreateTag = async () => {
    setTagError(null);
    const validation = nameSchema.safeParse(tagName.trim());
    if (!validation.success) {
      setTagError(validation.error.errors[0]?.message ?? 'Der Tag ist nicht gültig. Bitte passe deine Eingabe an.');
      return;
    }
    try {
      setLoadingTags(true);
      const newTag = await createTag(validation.data);
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setTagName('');
      setTagInfo(`Tag „${newTag.name}“ wurde hinzugefügt.`);
    } catch (error) {
      setTagError(extractApiError(error, 'Der Tag konnte nicht erstellt werden. Bitte versuche es gleich erneut.'));
    } finally {
      setLoadingTags(false);
    }
  };

  /**
   * Handles the deletion of a tag.
   * Calls the API to delete the tag and updates the tags state.
   * @param {number} id - The ID of the tag to delete.
   */
  const handleDeleteTag = async (id: number) => {
    try {
      setLoadingTags(true);
      await deleteTag(id);
      setTags((prev) => prev.filter((tag) => tag.id !== id));
      const removedTagName = tags.find((tag) => tag.id === id)?.name ?? 'Tag';
      setTagInfo(`„${removedTagName}“ wurde gelöscht.`);
    } catch (error) {
      setTagError(extractApiError(error, 'Der Tag konnte nicht gelöscht werden. Bitte lade die Seite neu und versuche es dann erneut.'));
    } finally {
      setLoadingTags(false);
    }
  };

  /**
   * Handles the creation of a new location.
   * Validates the location name, calls the API, and updates the locations state.
   */
  const handleCreateLocation = async () => {
    setLocationError(null);
    const validation = nameSchema.safeParse(locationName.trim());
    if (!validation.success) {
      setLocationError(validation.error.errors[0]?.message ?? 'Der Standort ist nicht gültig. Bitte überprüfe deine Eingabe.');
      return;
    }
    try {
      setLoadingLocations(true);
      const newLocation = await createLocation(validation.data);
      setLocations((prev) => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name)));
      setLocationName('');
      setLocationInfo(`Standort „${newLocation.name}“ wurde erstellt.`);
    } catch (error) {
      setLocationError(
        extractApiError(error, 'Der Standort konnte nicht erstellt werden. Versuche es bitte kurz darauf erneut.'),
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  /**
   * Handles the deletion of a location.
   * Calls the API to delete the location and updates the locations state.
   * @param {number} id - The ID of the location to delete.
   */
  const handleDeleteLocation = async (id: number) => {
    try {
      setLoadingLocations(true);
      await deleteLocation(id);
      setLocations((prev) => prev.filter((location) => location.id !== id));
      const removedLocationName = locations.find((location) => location.id === id)?.name ?? 'Standort';
      setLocationInfo(`„${removedLocationName}“ wurde gelöscht.`);
    } catch (error) {
      setLocationError(
        extractApiError(
          error,
          'Der Standort konnte nicht gelöscht werden. Aktualisiere bitte die Seite und versuche es erneut.',
        ),
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  return (
    <div className="grid gap-6 text-slate-700 lg:grid-cols-2">
      {initialError && (
        <div className="lg:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {initialError}
        </div>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tags verwalten</h2>
            <p className="text-sm text-slate-600">Verleihe deinen Gegenständen Kontext für blitzschnelle Filter und Analysen.</p>
          </div>
        </header>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Tag-Namen eingeben …"
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          />
          <Button type="button" variant="primary" size="sm" loading={loadingTags} onClick={handleCreateTag}>
            Hinzufügen
          </Button>
        </div>
        {tagError && <p className="mt-2 text-xs text-red-500">{tagError}</p>}
        {tagInfo && !tagError && (
          <p className="mt-2 text-xs text-emerald-600">{tagInfo}</p>
        )}

        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span>{tag.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteTag(tag.id)} disabled={loadingTags}>
                Löschen
              </Button>
            </li>
          ))}
          {tags.length === 0 && <li className="text-xs text-slate-500">Noch keine Tags vorhanden – starte mit einem Namen deiner Wahl.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Standorte verwalten</h2>
            <p className="text-sm text-slate-600">Ordne Gegenstände Schränken, Räumen oder Bereichen zu – jederzeit wieder auffindbar.</p>
          </div>
        </header>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Standort benennen …"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={loadingLocations}
            onClick={handleCreateLocation}
          >
            Hinzufügen
          </Button>
        </div>
        {locationError && <p className="mt-2 text-xs text-red-500">{locationError}</p>}
        {locationInfo && !locationError && (
          <p className="mt-2 text-xs text-emerald-600">{locationInfo}</p>
        )}

        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          {locations.map((location) => (
            <li
              key={location.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span>{location.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteLocation(location.id)}
                disabled={loadingLocations}
              >
                Löschen
              </Button>
            </li>
          ))}
          {locations.length === 0 && <li className="text-xs text-slate-500">Noch keine Standorte vorhanden – benenne deine erste Ablage jetzt.</li>}
        </ul>
      </section>
    </div>
  );
};

export default SettingsPage;
