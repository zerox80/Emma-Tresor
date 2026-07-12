import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { deleteItem, fetchItem } from "../../../api/inventory";
import type { Item, PaginatedResponse } from "../../../types/inventory";
import { ITEMS_PAGE_SIZE } from "../constants";

interface UseItemDetailsArgs {
  items: Item[];
  itemsVersion: number;
  loadItems: () => Promise<void>;
  page: number;
  pagination: PaginatedResponse<Item> | null;
  setInfoMessage: Dispatch<SetStateAction<string | null>>;
  setPage: Dispatch<SetStateAction<number>>;
}

export const useItemDetails = ({
  items,
  itemsVersion,
  loadItems,
  page,
  pagination,
  setInfoMessage,
  setPage,
}: UseItemDetailsArgs) => {
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [navigationDirection, setNavigationDirection] = useState<
    "next" | "previous" | null
  >(null);
  const [pendingNavigation, setPendingNavigation] = useState<
    "next" | "previous" | null
  >(null);
  const navigationStartVersion = useRef<number | null>(null);

  const loadDetails = useCallback(async (itemId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetailItem(await fetchItem(itemId));
    } catch {
      setDetailError(
        "Details konnten nicht geladen werden. Bitte versuche es erneut.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetails = useCallback(
    (itemId: number, options?: { fromNavigation?: "next" | "previous" }) => {
      setDetailItemId(itemId);
      setDetailItem(items.find((item) => item.id === itemId) ?? null);
      const request = loadDetails(itemId);

      if (options?.fromNavigation) {
        void request.finally(() => {
          setNavigationDirection((current) =>
            current === options.fromNavigation ? null : current,
          );
        });
      } else {
        setNavigationDirection(null);
      }
    },
    [items, loadDetails],
  );

  const closeDetails = useCallback(() => {
    setDetailItemId(null);
    setDetailItem(null);
    setDetailError(null);
    setDeleteError(null);
    setDeleteLoading(false);
    setPendingNavigation(null);
    setNavigationDirection(null);
    navigationStartVersion.current = null;
  }, []);

  const retryDetails = useCallback(() => {
    if (detailItemId != null) {
      void loadDetails(detailItemId);
    }
  }, [detailItemId, loadDetails]);

  const removeItem = useCallback(async () => {
    if (detailItemId == null) {
      return;
    }
    const itemName = detailItem?.name ?? "Gegenstand";
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteItem(detailItemId);
      setInfoMessage(`"${itemName}" wurde gelöscht.`);
      closeDetails();
      await loadItems();
    } catch {
      setDeleteError(
        "Gegenstand konnte nicht gelöscht werden. Bitte versuche es erneut.",
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [closeDetails, detailItem, detailItemId, loadItems, setInfoMessage]);

  const currentIndex = useMemo(
    () =>
      detailItemId == null
        ? -1
        : items.findIndex((item) => item.id === detailItemId),
    [detailItemId, items],
  );

  const navigateDetails = useCallback(
    (direction: "next" | "previous") => {
      if (currentIndex === -1) {
        return;
      }

      const targetIndex = currentIndex + (direction === "next" ? 1 : -1);
      const target = items[targetIndex];
      if (target) {
        setNavigationDirection(direction);
        openDetails(target.id, { fromNavigation: direction });
        return;
      }

      const hasAdjacentPage =
        direction === "next" ? pagination?.next : pagination?.previous;
      if (!hasAdjacentPage) {
        return;
      }

      setNavigationDirection(direction);
      navigationStartVersion.current = itemsVersion;
      setPendingNavigation(direction);
      setPage((currentPage) =>
        direction === "next" ? currentPage + 1 : Math.max(currentPage - 1, 1),
      );
    },
    [currentIndex, items, itemsVersion, openDetails, pagination, setPage],
  );

  useEffect(() => {
    if (
      !pendingNavigation ||
      (navigationStartVersion.current !== null &&
        itemsVersion === navigationStartVersion.current)
    ) {
      return;
    }

    const target =
      pendingNavigation === "next" ? items[0] : items[items.length - 1];
    if (target) {
      openDetails(target.id, { fromNavigation: pendingNavigation });
    } else {
      setNavigationDirection(null);
    }
    setPendingNavigation(null);
    navigationStartVersion.current = null;
  }, [items, itemsVersion, openDetails, pendingNavigation]);

  const canNavigateNext =
    (currentIndex !== -1 && currentIndex < items.length - 1) ||
    Boolean(pagination?.next);
  const canNavigatePrevious =
    currentIndex > 0 || Boolean(pagination?.previous);
  const positionInfo =
    currentIndex === -1
      ? null
      : {
          current: (page - 1) * ITEMS_PAGE_SIZE + currentIndex + 1,
          total:
            pagination?.count ??
            (page - 1) * ITEMS_PAGE_SIZE + items.length,
        };

  const updateVisibleItem = useCallback(
    (item: Item) => {
      if (detailItemId === item.id) {
        setDetailItem(item);
      }
    },
    [detailItemId],
  );

  return {
    detailItemId,
    detailItem,
    detailLoading,
    detailError,
    deleteLoading,
    deleteError,
    navigationDirection,
    canNavigateNext,
    canNavigatePrevious,
    positionInfo,
    openDetails,
    closeDetails,
    retryDetails,
    removeItem,
    navigateNext: () => navigateDetails("next"),
    navigatePrevious: () => navigateDetails("previous"),
    updateVisibleItem,
  };
};
