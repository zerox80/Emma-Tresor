import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDuplicateQuarantineEntry,
  fetchDuplicateFinder,
  fetchDuplicateQuarantineEntries,
  releaseDuplicateQuarantineEntry,
  type DuplicateFinderParams,
  type FetchItemsOptions,
} from '../../../api/inventory';
import type { DuplicateGroup, DuplicateQuarantineEntry } from '../../../types/inventory';

interface UseDuplicateFinderArgs {
  searchTerm: string;
  selectedTagIds: number[];
  selectedLocationIds: number[];
  ordering: string;
  finderParams: DuplicateFinderParams;
}

interface UseDuplicateFinderResult {
  duplicates: DuplicateGroup[];
  duplicatesLoading: boolean;
  duplicatesError: string | null;
  presetUsed: string | null;
  analyzedCount: number;
  limit: number;
  loadDuplicates: (overrideParams?: DuplicateFinderParams) => Promise<void>;
  markGroupAsFalsePositive: (group: DuplicateGroup) => Promise<DuplicateQuarantineEntry[]>;
  quarantineEntries: DuplicateQuarantineEntry[];
  quarantineLoading: boolean;
  quarantineError: string | null;
  loadQuarantine: () => Promise<void>;
  releaseQuarantineEntry: (entryId: number) => Promise<void>;
}

const buildFiltersFromArgs = ({ searchTerm, selectedLocationIds, selectedTagIds, ordering }: UseDuplicateFinderArgs): FetchItemsOptions => ({
  query: searchTerm || undefined,
  locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
  tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  ordering: ordering.trim().length > 0 ? ordering : undefined,
});

export const useDuplicateFinder = (args: UseDuplicateFinderArgs): UseDuplicateFinderResult => {
  const { searchTerm, selectedLocationIds, selectedTagIds, ordering, finderParams } = args;
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const [presetUsed, setPresetUsed] = useState<string | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [limit, setLimit] = useState(0);

  const [quarantineEntries, setQuarantineEntries] = useState<DuplicateQuarantineEntry[]>([]);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);

  const filters = useMemo(
    () => buildFiltersFromArgs({ searchTerm, selectedLocationIds, selectedTagIds, ordering }),
    [ordering, searchTerm, selectedLocationIds, selectedTagIds],
  );

  const loadDuplicates = useCallback(
    async (overrideParams?: DuplicateFinderParams) => {
      setDuplicatesLoading(true);
      setDuplicatesError(null);
      const paramsToUse = overrideParams ?? finderParams ?? { preset: 'auto' };
      try {
        const response = await fetchDuplicateFinder(paramsToUse, filters);
        setDuplicates(response.results);
        setPresetUsed(response.preset_used);
        setAnalyzedCount(response.analyzed_count);
        setLimit(response.limit);
      } catch (error) {
        setDuplicatesError('Duplikate konnten nicht geladen werden.');
      } finally {
        setDuplicatesLoading(false);
      }
    },
    [filters, finderParams],
  );

  const loadQuarantine = useCallback(async () => {
    setQuarantineLoading(true);
    setQuarantineError(null);
    try {
      const entries = await fetchDuplicateQuarantineEntries({ is_active: true });
      setQuarantineEntries(entries);
    } catch (error) {
      setQuarantineError('Quarantäne konnte nicht geladen werden.');
    } finally {
      setQuarantineLoading(false);
    }
  }, []);

  const createQuarantineEntry = useCallback(async (itemAId: number, itemBId: number) => {
    try {
      const entry = await createDuplicateQuarantineEntry({ item_a_id: itemAId, item_b_id: itemBId, reason: 'False Positive' });
      setQuarantineEntries((prev) => [entry, ...prev]);
      return entry;
    } catch (error) {
      throw new Error('Eintrag konnte nicht in die Quarantäne verschoben werden.');
    }
  }, []);

  const markGroupAsFalsePositive = useCallback(
    async (group: DuplicateGroup) => {
      if (group.items.length < 2) {
        return [];
      }
      const anchor = group.items[0];
      const createdEntries: DuplicateQuarantineEntry[] = [];
      for (let i = 1; i < group.items.length; i += 1) {
        const target = group.items[i];
        const entry = await createQuarantineEntry(anchor.id, target.id);
        createdEntries.push(entry);
      }
      setDuplicates((prev) => prev.filter((candidate) => candidate.group_id !== group.group_id));
      return createdEntries;
    },
    [createQuarantineEntry],
  );

  const releaseQuarantineEntry = useCallback(async (entryId: number) => {
    try {
      await releaseDuplicateQuarantineEntry(entryId);
      setQuarantineEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (error) {
      throw new Error('Eintrag konnte nicht entfernt werden.');
    }
  }, []);

  useEffect(() => {
    void loadDuplicates();
  }, [loadDuplicates]);

  return {
    duplicates,
    duplicatesLoading,
    duplicatesError,
    presetUsed,
    analyzedCount,
    limit,
    loadDuplicates,
    markGroupAsFalsePositive,
    quarantineEntries,
    quarantineLoading,
    quarantineError,
    loadQuarantine,
    releaseQuarantineEntry,
  };
};
