import { useCallback, useState } from 'react';
import type { AxiosError } from 'axios';

import { exportItems } from '../../../api/inventory.js';
import { extractDetailMessage } from '../utils/itemHelpers.js';

interface UseItemsExportArgs {
  debouncedSearchTerm: string;
  ordering: string;
  selectedTagIds: number[];
  selectedLocationIds: number[];
}

interface UseItemsExportResult {
  exportingItems: boolean;
  exportError: string | null;
  handleExportItems: () => Promise<void>;
  dismissExportError: () => void;
}

const downloadBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventar-export-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const useItemsExport = ({
  debouncedSearchTerm,
  ordering,
  selectedTagIds,
  selectedLocationIds,
}: UseItemsExportArgs): UseItemsExportResult => {
  const [exportingItems, setExportingItems] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportItems = useCallback(async () => {
    setExportError(null);
    setExportingItems(true);
    try {
      const blob = await exportItems({
        query: debouncedSearchTerm || undefined,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        locations: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        ordering: ordering.trim().length > 0 ? ordering : undefined,
      });
      downloadBlob(blob);
    } catch (error) {
      const axiosError = error as AxiosError;
      const message = extractDetailMessage(axiosError) ?? 'Export fehlgeschlagen. Bitte versuche es erneut.';
      setExportError(message);
    } finally {
      setExportingItems(false);
    }
  }, [debouncedSearchTerm, ordering, selectedLocationIds, selectedTagIds]);

  const dismissExportError = useCallback(() => {
    setExportError(null);
  }, []);

  return {
    exportingItems,
    exportError,
    handleExportItems,
    dismissExportError,
  };
};
