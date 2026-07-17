import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createDuplicateQuarantineEntries,
  fetchDuplicateFinder,
  fetchDuplicateQuarantineEntries,
  releaseDuplicateQuarantineEntry,
  releaseDuplicateQuarantineEntries,
  type DuplicateFinderParams,
  type FetchItemsOptions,
} from "../../../api/inventory";
import type {
  DuplicateGroup,
  DuplicateQuarantineEntry,
} from "../../../types/inventory";

interface UseDuplicateFinderArgs {
  enabled: boolean;
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
  markGroupAsFalsePositive: (
    group: DuplicateGroup,
  ) => Promise<DuplicateQuarantineEntry[]>;
  quarantineEntries: DuplicateQuarantineEntry[];
  quarantineLoading: boolean;
  quarantineError: string | null;
  loadQuarantine: () => Promise<void>;
  releaseQuarantineEntry: (entryId: number) => Promise<void>;
  releaseQuarantineEntries: (entryIds: number[]) => Promise<void>;
}

type DuplicateFinderFilters = Omit<
  UseDuplicateFinderArgs,
  "enabled" | "finderParams"
>;

const buildFiltersFromArgs = ({
  searchTerm,
  selectedLocationIds,
  selectedTagIds,
  ordering,
}: DuplicateFinderFilters): FetchItemsOptions => ({
  query: searchTerm || undefined,
  locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
  tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  ordering: ordering.trim().length > 0 ? ordering : undefined,
});

export const useDuplicateFinder = (
  args: UseDuplicateFinderArgs,
): UseDuplicateFinderResult => {
  const {
    searchTerm,
    selectedLocationIds,
    selectedTagIds,
    ordering,
    finderParams,
    enabled,
  } = args;
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const [presetUsed, setPresetUsed] = useState<string | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [limit, setLimit] = useState(0);

  const [quarantineEntries, setQuarantineEntries] = useState<
    DuplicateQuarantineEntry[]
  >([]);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);

  const filters = useMemo(
    () =>
      buildFiltersFromArgs({
        searchTerm,
        selectedLocationIds,
        selectedTagIds,
        ordering,
      }),
    [ordering, searchTerm, selectedLocationIds, selectedTagIds],
  );

  const loadDuplicates = useCallback(
    async (overrideParams?: DuplicateFinderParams) => {
      setDuplicatesLoading(true);
      setDuplicatesError(null);
      const paramsToUse = overrideParams ?? finderParams ?? { preset: "auto" };
      try {
        const response = await fetchDuplicateFinder(paramsToUse, filters);
        setDuplicates(response.results);
        setPresetUsed(response.preset_used);
        setAnalyzedCount(response.analyzed_count);
        setLimit(response.limit);
      } catch (error) {
        setDuplicatesError("Duplikate konnten nicht geladen werden.");
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
      const entries = await fetchDuplicateQuarantineEntries({
        is_active: true,
      });
      setQuarantineEntries(entries);
    } catch (error) {
      setQuarantineError("Quarantäne konnte nicht geladen werden.");
    } finally {
      setQuarantineLoading(false);
    }
  }, []);

  const markGroupAsFalsePositive = useCallback(
    async (group: DuplicateGroup) => {
      if (group.items.length < 2) {
        return [];
      }
      const anchor = group.items[0];
      try {
        const createdEntries = await createDuplicateQuarantineEntries(
          group.items.slice(1).map((target) => ({
            item_a_id: anchor.id,
            item_b_id: target.id,
          })),
          "False Positive",
        );
        setQuarantineEntries((prev) => [...createdEntries, ...prev]);
        setDuplicates((prev) =>
          prev.filter((candidate) => candidate.group_id !== group.group_id),
        );
        return createdEntries;
      } catch (error) {
        throw new Error(
          "Eintrag konnte nicht in die Quarantäne verschoben werden.",
        );
      }
    },
    [],
  );

  const releaseQuarantineEntry = useCallback(async (entryId: number) => {
    try {
      await releaseDuplicateQuarantineEntry(entryId);
      setQuarantineEntries((prev) =>
        prev.filter((entry) => entry.id !== entryId),
      );
    } catch (error) {
      throw new Error("Eintrag konnte nicht entfernt werden.");
    }
  }, []);

  const releaseQuarantineEntries = useCallback(async (entryIds: number[]) => {
    try {
      await releaseDuplicateQuarantineEntries(entryIds);
      const released = new Set(entryIds);
      setQuarantineEntries((prev) =>
        prev.filter((entry) => !released.has(entry.id)),
      );
    } catch (error) {
      throw new Error("Einträge konnten nicht entfernt werden.");
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void loadDuplicates();
    }
  }, [enabled, loadDuplicates]);

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
    releaseQuarantineEntries,
  };
};
