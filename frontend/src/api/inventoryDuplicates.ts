import apiClient from "./client";
import type {
  DuplicateFinderResponse,
  DuplicateQuarantineEntry,
} from "../types/inventory";
import type { FetchItemsOptions } from "./inventory";

export interface DuplicateFinderParams {
  preset?: "auto";
  name_match?: "none" | "exact" | "prefix" | "contains";
  description_match?: "none" | "exact" | "contains";
  wodis_match?: "none" | "exact";
  purchase_date_tolerance_days?: number;
  limit?: number;
  require_any_text_match?: boolean;
}

export const fetchDuplicateFinder = async (
  params: DuplicateFinderParams = { preset: "auto" },
  filters?: FetchItemsOptions,
): Promise<DuplicateFinderResponse> => {
  const requestParams: Record<string, string | number | boolean> = {
    ...params,
  };

  if (filters?.query) {
    requestParams.search = filters.query;
  }
  if (filters?.tags && filters.tags.length > 0) {
    requestParams.tags = filters.tags.join(",");
  }
  if (filters?.locations && filters.locations.length > 0) {
    requestParams.location = filters.locations.join(",");
  }
  if (filters?.ordering) {
    requestParams.ordering = filters.ordering;
  }

  const { data } = await apiClient.get<DuplicateFinderResponse>(
    "/items/duplicates/",
    {
      params: requestParams,
    },
  );
  return data;
};

export interface CreateDuplicateQuarantinePayload {
  item_a_id: number;
  item_b_id: number;
  reason?: string;
  notes?: string;
}

export const createDuplicateQuarantineEntry = async (
  payload: CreateDuplicateQuarantinePayload,
): Promise<DuplicateQuarantineEntry> => {
  const { data } = await apiClient.post<DuplicateQuarantineEntry>(
    "/duplicate-quarantine/",
    payload,
  );
  return data;
};

export const fetchDuplicateQuarantineEntries = async (
  options: { is_active?: boolean } = { is_active: true },
): Promise<DuplicateQuarantineEntry[]> => {
  const { data } = await apiClient.get<DuplicateQuarantineEntry[]>(
    "/duplicate-quarantine/",
    {
      params: options,
    },
  );
  return data;
};

export const releaseDuplicateQuarantineEntry = async (
  entryId: number,
): Promise<void> => {
  await apiClient.delete(`/duplicate-quarantine/${entryId}/`);
};

export const restoreDuplicateQuarantineEntry = async (
  entryId: number,
): Promise<DuplicateQuarantineEntry> => {
  const { data } = await apiClient.post<DuplicateQuarantineEntry>(
    `/duplicate-quarantine/${entryId}/restore/`,
  );
  return data;
};
