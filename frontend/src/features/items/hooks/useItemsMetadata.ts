import { useCallback, useEffect, useRef, useState } from 'react';

import { createLocation, createTag, fetchLocations, fetchTags } from '../../../api/inventory';
import type { Location, Tag } from '../../../types/inventory';

interface UseItemsMetadataResult {
  tags: Tag[];
  locations: Location[];
  metaLoading: boolean;
  metaError: string | null;
  reloadMeta: () => Promise<void>;
  handleCreateTag: (name: string) => Promise<Tag>;
  handleCreateLocation: (name: string) => Promise<Location>;
}

const sortByName = <T extends { name: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));

export const useItemsMetadata = (): UseItemsMetadataResult => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const latestRequestId = useRef(0);

  const loadMeta = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [fetchedTags, fetchedLocations] = await Promise.all([fetchTags(), fetchLocations()]);
      if (mountedRef.current && requestId === latestRequestId.current) {
        setTags(sortByName(fetchedTags));
        setLocations(sortByName(fetchedLocations));
      }
    } catch (error) {
      if (mountedRef.current && requestId === latestRequestId.current) {
        setMetaError('Tags und Standorte konnten nicht geladen werden. Bitte versuche es erneut.');
      }
    } finally {
      if (mountedRef.current && requestId === latestRequestId.current) {
        setMetaLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadMeta();
    return () => {
      mountedRef.current = false;
      latestRequestId.current += 1;
    };
  }, [loadMeta]);

  const handleCreateTag = useCallback(async (name: string) => {
    const newTag = await createTag(name);
    setTags((prev) => sortByName([...prev, newTag]));
    return newTag;
  }, []);

  const handleCreateLocation = useCallback(async (name: string) => {
    const newLocation = await createLocation(name);
    setLocations((prev) => sortByName([...prev, newLocation]));
    return newLocation;
  }, []);

  return {
    tags,
    locations,
    metaLoading,
    metaError,
    reloadMeta: loadMeta,
    handleCreateTag,
    handleCreateLocation,
  };
};
