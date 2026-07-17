import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DuplicateFinderParams } from "../../../api/inventory";
import type { DuplicateGroup, DuplicateQuarantineEntry } from "../../../types/inventory";
import {
  DEFAULT_DUPLICATE_STRICTNESS,
  DUPLICATE_STRICTNESS_OPTIONS,
  type DuplicateStrictnessLevel,
} from "../constants";
import { useDuplicateFinder } from "./useDuplicateFinder";

interface UseItemsDuplicateControllerArgs {
  ordering: string;
  searchTerm: string;
  selectedLocationIds: number[];
  selectedTagIds: number[];
}

export const useItemsDuplicateController = ({
  ordering,
  searchTerm,
  selectedLocationIds,
  selectedTagIds,
}: UseItemsDuplicateControllerArgs) => {
  const [isOpen, setIsOpen] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<number | null>(null);
  const [releasingEntryId, setReleasingEntryId] = useState<number | null>(null);
  const [undoEntries, setUndoEntries] = useState<
    DuplicateQuarantineEntry[] | null
  >(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [undoInProgress, setUndoInProgress] = useState(false);
  const undoTimer = useRef<number | null>(null);
  const [strictness, setStrictness] = useState<DuplicateStrictnessLevel>(
    DEFAULT_DUPLICATE_STRICTNESS,
  );

  const finderParams = useMemo<DuplicateFinderParams>(() => {
    const option = DUPLICATE_STRICTNESS_OPTIONS.find(
      (candidate) => candidate.id === strictness,
    );
    return option?.params ?? { preset: "auto" };
  }, [strictness]);

  const finder = useDuplicateFinder({
    enabled: isOpen,
    searchTerm,
    selectedTagIds,
    selectedLocationIds,
    ordering,
    finderParams,
  });

  useEffect(() => {
    if (isOpen) {
      void finder.loadQuarantine();
    }
  }, [finder.loadQuarantine, isOpen]);

  const markFalsePositive = useCallback(
    async (group: DuplicateGroup) => {
      try {
        setMarkingGroupId(group.group_id);
        const entries = await finder.markGroupAsFalsePositive(group);
        if (entries.length > 0) {
          setUndoEntries(entries);
          setUndoError(null);
        }
        await finder.loadDuplicates();
      } catch {
        setUndoError("Duplikate konnten nicht ausgeblendet werden.");
      } finally {
        setMarkingGroupId(null);
      }
    },
    [finder.loadDuplicates, finder.markGroupAsFalsePositive],
  );

  const releaseEntry = useCallback(
    async (entryId: number) => {
      try {
        setReleasingEntryId(entryId);
        await finder.releaseQuarantineEntry(entryId);
        await finder.loadDuplicates();
      } catch {
        setUndoError("Eintrag konnte nicht wiederhergestellt werden.");
      } finally {
        setReleasingEntryId(null);
      }
    },
    [finder.loadDuplicates, finder.releaseQuarantineEntry],
  );

  const undoFalsePositive = useCallback(async () => {
    if (!undoEntries || undoInProgress) {
      return;
    }
    try {
      setUndoInProgress(true);
      await finder.releaseQuarantineEntries(
        undoEntries.map((entry) => entry.id),
      );
      setUndoEntries(null);
      await finder.loadDuplicates();
    } catch {
      setUndoError("Rückgängig konnte nicht durchgeführt werden.");
    } finally {
      setUndoInProgress(false);
    }
  }, [finder, undoEntries, undoInProgress]);

  const dismissUndo = useCallback(() => {
    setUndoEntries(null);
    setUndoError(null);
  }, []);

  useEffect(() => {
    if (!undoEntries) {
      if (undoTimer.current) {
        window.clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }
      return;
    }
    undoTimer.current = window.setTimeout(dismissUndo, 7000);
    return () => {
      if (undoTimer.current) {
        window.clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }
    };
  }, [dismissUndo, undoEntries]);

  return {
    ...finder,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    alertCount: finder.duplicates.length,
    markingGroupId,
    releasingEntryId,
    strictness,
    setStrictness,
    markFalsePositive,
    releaseEntry,
    undoEntries,
    undoError,
    undoInProgress,
    undoFalsePositive,
    dismissUndo,
  };
};
