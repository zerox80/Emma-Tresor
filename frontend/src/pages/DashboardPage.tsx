import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";

import Button from "../components/common/Button";
import ListItemsPreviewSheet from "../components/ListItemsPreviewSheet";
import ManageListItemsSheet, {
  type ManageableItem,
} from "../components/ManageListItemsSheet";
import {
  exportListItems,
  fetchAllItems,
  fetchLists,
  fetchLocations,
  fetchTags,
  updateListItems,
} from "../api/inventory";
import type { Item, ItemList, Location, Tag } from "../types/inventory";
import DashboardContent from "./DashboardContent";

export interface DashboardStats {
  items: Item[];
  lists: ItemList[];
  tags: Tag[];
  locations: Location[];
}

export interface ListWithDetail extends ItemList {
  resolvedItems: Item[];
  isExpanded?: boolean;
}

const MAX_LISTS_DISPLAYED = 4;

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<number>>(
    new Set<number>(),
  );
  const [listsWithDetail, setListsWithDetail] = useState<ListWithDetail[]>([]);
  const [manageTarget, setManageTarget] = useState<ListWithDetail | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ListWithDetail | null>(
    null,
  );
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [previewExporting, setPreviewExporting] = useState(false);
  const [previewExportError, setPreviewExportError] = useState<string | null>(
    null,
  );
  const [listExportingId, setListExportingId] = useState<number | null>(null);
  const [listExportError, setListExportError] = useState<string | null>(null);
  const [showAllLists, setShowAllLists] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, lists, tags, locations] = await Promise.all([
        fetchAllItems(),
        fetchLists(),
        fetchTags(),
        fetchLocations(),
      ]);
      setStats({ items, lists, tags, locations });
    } catch (err) {
      const axiosError = err as AxiosError;
      const detail =
        axiosError.response?.data &&
        typeof axiosError.response.data === "object"
          ? (axiosError.response.data as { detail?: string }).detail
          : null;
      setError(
        detail ??
          "Das Dashboard konnte nicht aktualisiert werden. Bitte überprüfe deine Verbindung und versuche es erneut.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!stats) {
      setListsWithDetail([]);
      return;
    }
    const itemMap = new Map<number, Item>(
      stats.items.map((item: Item) => [item.id, item]),
    );
    setListsWithDetail(
      stats.lists.map((list) => ({
        ...list,
        resolvedItems: list.items
          .map((itemId) => itemMap.get(itemId))
          .filter((entry): entry is Item => Boolean(entry))
          .sort((a: Item, b: Item) => a.name.localeCompare(b.name)),
        isExpanded: expandedLists.has(list.id),
      })),
    );
  }, [stats, expandedLists]);

  const locationLookup = useMemo(() => {
    if (!stats) {
      return new Map<number, string>();
    }
    return new Map<number, string>(
      stats.locations.map((location: Location) => [location.id, location.name]),
    );
  }, [stats]);

  const itemsTotalValue = useMemo(() => {
    if (!stats) {
      return 0;
    }
    return stats.items.reduce((total: number, item: Item) => {
      if (!item.value) {
        return total;
      }
      const numeric = Number.parseFloat(item.value);
      if (Number.isNaN(numeric) || !Number.isFinite(numeric) || numeric < 0) {
        return total;
      }
      return total + numeric;
    }, 0);
  }, [stats]);

  const manageableItems = useMemo<ManageableItem[]>(() => {
    if (!stats) {
      return [];
    }
    const assignmentCount = new Map<number, number>();
    stats.lists.forEach((list) => {
      list.items.forEach((itemId) => {
        assignmentCount.set(itemId, (assignmentCount.get(itemId) ?? 0) + 1);
      });
    });
    return stats.items.map((item) => ({
      ...item,
      assignmentCount: assignmentCount.get(item.id) ?? 0,
    }));
  }, [stats]);

  const handleToggleList = useCallback((listId: number) => {
    setExpandedLists((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, []);

  const handleOpenManage = useCallback(
    (listId: number) => {
      const target =
        listsWithDetail.find((list: ListWithDetail) => list.id === listId) ??
        null;
      setManageTarget(target);
      setManageError(null);
    },
    [listsWithDetail],
  );

  const handleCloseManage = useCallback(() => {
    if (manageSaving) {
      return;
    }
    setManageTarget(null);
    setManageError(null);
  }, [manageSaving]);

  const handleOpenPreview = useCallback(
    (listId: number) => {
      const target =
        listsWithDetail.find((list: ListWithDetail) => list.id === listId) ??
        null;
      setPreviewTarget(target);
      setPreviewExportError(null);
      setPreviewExporting(false);
      setListExportError(null);
    },
    [listsWithDetail],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewTarget(null);
    setPreviewExportError(null);
    setPreviewExporting(false);
  }, []);

  const handleNavigateToList = useCallback(() => {
    if (!previewTarget) {
      return;
    }
    window.location.assign(`/lists#list-${previewTarget.id}`);
  }, [previewTarget]);

  const handlePreviewItemDetails = useCallback((item: Item) => {
    const assetTag = item.asset_tag.trim();
    if (assetTag.length === 0) {
      const params = new URLSearchParams({ focusItemId: String(item.id) });
      window.location.assign(`/items?${params.toString()}`);
      return;
    }
    window.location.assign(`/scan/${encodeURIComponent(assetTag)}`);
  }, []);

  const createListExportFilename = useCallback(
    (listId: number, listName: string) => {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0];
      const safeName = listName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const fallbackName = `liste-${listId}`;
      return `inventarliste-${safeName || fallbackName}-${timestamp}.csv`;
    },
    [],
  );

  const triggerCsvDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  const exportListToCsv = useCallback(
    async (listId: number, listName: string) => {
      const blob = await exportListItems(listId);
      const filename = createListExportFilename(listId, listName);
      triggerCsvDownload(blob, filename);
    },
    [createListExportFilename, triggerCsvDownload],
  );

  const handleExportPreviewList = useCallback(async () => {
    if (!previewTarget) {
      return;
    }
    setPreviewExportError(null);
    setPreviewExporting(true);
    try {
      await exportListToCsv(previewTarget.id, previewTarget.name);
    } catch (err) {
      const axiosError = err as AxiosError;
      const detail =
        axiosError.response?.data &&
        typeof axiosError.response.data === "object"
          ? (axiosError.response.data as { detail?: string }).detail
          : null;
      setPreviewExportError(
        detail ?? "Export der Liste fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setPreviewExporting(false);
    }
  }, [previewTarget, exportListToCsv]);

  const handleExportOverviewList = useCallback(
    async (list: ListWithDetail) => {
      setListExportError(null);
      setListExportingId(list.id);
      try {
        await exportListToCsv(list.id, list.name);
      } catch (err) {
        const axiosError = err as AxiosError;
        const detail =
          axiosError.response?.data &&
          typeof axiosError.response.data === "object"
            ? (axiosError.response.data as { detail?: string }).detail
            : null;
        setListExportError(
          detail ??
            "Export der Liste fehlgeschlagen. Bitte versuche es erneut.",
        );
      } finally {
        setListExportingId(null);
      }
    },
    [exportListToCsv],
  );

  const handleSaveManage = useCallback(
    async (itemIds: number[]) => {
      if (!manageTarget) {
        return;
      }
      setManageSaving(true);
      setManageError(null);
      try {
        const updated = await updateListItems(manageTarget.id, itemIds);
        setStats((prev: DashboardStats | null) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            lists: prev.lists.map((list) =>
              list.id === updated.id ? updated : list,
            ),
          };
        });
        setManageTarget(null);
      } catch (err) {
        const axiosError = err as AxiosError;
        const detail =
          axiosError.response?.data &&
          typeof axiosError.response.data === "object"
            ? (axiosError.response.data as { detail?: string }).detail
            : null;
        setManageError(
          detail ?? "Änderungen konnten nicht gespeichert werden.",
        );
      } finally {
        setManageSaving(false);
      }
    },
    [manageTarget],
  );

  return (
    <DashboardContent
      error={error}
      loading={loading}
      stats={stats}
      itemsTotalValue={itemsTotalValue}
      listsWithDetail={listsWithDetail}
      showAllLists={showAllLists}
      setShowAllLists={setShowAllLists}
      expandedLists={expandedLists}
      handleToggleList={handleToggleList}
      listExportError={listExportError}
      setListExportError={setListExportError}
      listExportingId={listExportingId}
      handleExportOverviewList={handleExportOverviewList}
      handleOpenPreview={handleOpenPreview}
      handleOpenManage={handleOpenManage}
      locationLookup={locationLookup}
      manageTarget={manageTarget}
      handleCloseManage={handleCloseManage}
      manageableItems={manageableItems}
      manageSaving={manageSaving}
      manageError={manageError}
      handleSaveManage={handleSaveManage}
      previewTarget={previewTarget}
      handleClosePreview={handleClosePreview}
      handlePreviewItemDetails={handlePreviewItemDetails}
      handleExportPreviewList={handleExportPreviewList}
      previewExporting={previewExporting}
      previewExportError={previewExportError}
    />
  );
};

export default DashboardPage;
