import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';

import ItemScanView from '../components/ItemScanView';
import { fetchItemByAssetTag, fetchItems, fetchLocations, fetchTags } from '../api/inventory';
import type { Item, Location, PaginatedResponse, Tag } from '../types/inventory';

/**
 * Defines the expected parameters from the URL route for the ScanItemPage.
 * @property {string} [assetTag] - The asset tag of the item to be displayed.
 */
type RouteParams = {
  assetTag?: string;
};

/**
 * The number of items to display per page when fetching context items for navigation.
 */
const PAGE_SIZE = 20;

/**
 * The page component responsible for displaying the details of an item, typically accessed
 * by scanning a QR code containing the item's asset tag. It fetches the item's data,
 * along with associated tags and locations, and provides navigation capabilities to
 * adjacent items within the overall inventory list.
 *
 * @returns {JSX.Element} The rendered scan item page.
 */
const ScanItemPage: React.FC = () => {
  const { assetTag } = useParams<RouteParams>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [contextItems, setContextItems] = useState<Item[]>([]);
  const [contextPagination, setContextPagination] = useState<PaginatedResponse<Item> | null>(null);
  const [contextPage, setContextPage] = useState(1);
  const [contextReady, setContextReady] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [navigationDirection, setNavigationDirection] = useState<'next' | 'previous' | null>(null);

  /**
   * Effect hook to load the item details, tags, and locations based on the `assetTag` from URL params.
   * It handles loading states, errors, and reloads data when `reloadToken` changes.
   */
  useEffect(() => {
    let active = true;

    if (!assetTag) {
      setError('Ungültiger QR-Code.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedItem, fetchedTags, fetchedLocations] = await Promise.all([
          fetchItemByAssetTag(assetTag),
          fetchTags(),
          fetchLocations(),
        ]);
        if (!active) {
          return;
        }
        setItem(fetchedItem);
        setTags(fetchedTags);
        setLocations(fetchedLocations);
        setContextReady(false); // Reset context readiness when main item changes
      } catch (err) {
        if (!active) {
          return;
        }
        const axiosError = err as AxiosError<{ detail?: string }>;
        const detailMessage = axiosError?.response?.data?.detail;
        const status = axiosError?.response?.status;
        const fallbackMessage =
          status === 404
            ? 'Gegenstand wurde nicht gefunden.'
            : 'Der Gegenstand konnte nicht geladen werden.';
        setError(detailMessage ?? fallbackMessage);
        setItem(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [assetTag, reloadToken]);

  /**
   * Memoized callback function to fetch a specific page of items from the API.
   * @param {number} pageNumber - The page number to fetch.
   * @returns {Promise<PaginatedResponse<Item>>} A promise that resolves with the paginated response.
   */
  const fetchItemsPage = useCallback(
    async (pageNumber: number) =>
      fetchItems({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        ordering: '-purchase_date', // Consistent ordering for navigation context
      }),
    [],
  );

  /**
   * Memoized boolean indicating whether the currently displayed item is present in the `contextItems` array.
   * @type {boolean}
   */
  const hasItemInCurrentPage = useMemo(() => {
    if (!item) {
      return false;
    }
    return contextItems.some((entry) => entry.id === item.id);
  }, [contextItems, item]);

  /**
   * Effect hook to locate the current item within the paginated inventory list.
   * This is necessary to establish a navigation context (previous/next items).
   * It iterates through pages until the item is found or all pages are checked.
   */
  useEffect(() => {
    if (!item) {
      setContextReady(false);
      return;
    }

    // If the item is already in the current context items, no need to re-fetch.
    if (hasItemInCurrentPage) {
      setContextReady(true);
      return;
    }

    let active = true;
    setContextReady(false);
    setContextError(null);

    const locateItemPage = async () => {
      try {
        let pageNumber = 1;
        while (active) {
          const response = await fetchItemsPage(pageNumber);
          if (!active) {
            return;
          }
          const index = response.results.findIndex((entry) => entry.id === item.id);
          if (index !== -1) {
            // Item found on this page
            setContextItems(response.results);
            setContextPagination(response);
            setContextPage(pageNumber);
            break;
          }

          if (!response.next) {
            // Item not found after checking all pages
            setContextItems(response.results);
            setContextPagination(response);
            setContextPage(pageNumber);
            break;
          }

          pageNumber += 1;
        }
      } catch (err) {
        if (active) {
          setContextItems([]);
          setContextPagination(null);
          setContextError('Inventarliste konnte nicht geladen werden.');
        }
      } finally {
        if (active) {
          setContextReady(true);
        }
      }
    };

    void locateItemPage();

    return () => {
      active = false;
    };
  }, [fetchItemsPage, hasItemInCurrentPage, item]);

  /**
   * Memoized map for quick lookup of tag names by their ID.
   * @type {Record<number, string>}
   */
  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])),
    [tags],
  );
  /**
   * Memoized map for quick lookup of location names by their ID.
   * @type {Record<number, string>}
   */
  const locationMap = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  /**
   * Callback to close the item scan view and navigate back to the main items page.
   */
  const handleClose = useCallback(() => {
    navigate('/items', { replace: true });
  }, [navigate]);

  /**
   * Callback to retry fetching the item details. Increments `reloadToken` to trigger the main `useEffect`.
   */
  const handleRetry = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  /**
   * Callback to navigate to the item's edit page.
   * If an item is loaded, it passes its ID to focus the edit dialog on the items page.
   */
  const handleEdit = useCallback(() => {
    if (item) {
      navigate('/items', { state: { focusItemId: item.id } });
      return;
    }
    navigate('/items');
  }, [item, navigate]);

  /**
   * Memoized index of the currently displayed item within the `contextItems` array.
   * @type {number}
   */
  const currentItemIndex = useMemo(() => {
    if (!item) {
      return -1;
    }
    return contextItems.findIndex((entry) => entry.id === item.id);
  }, [contextItems, item]);

  /**
   * Memoized boolean indicating if navigation to the next item is possible.
   * Considers items on the current page and the availability of a next paginated page.
   * @type {boolean}
   */
  const canNavigateNext = useMemo(() => {
    if (!contextReady || !item) {
      return false;
    }
    if (currentItemIndex === -1) {
      return false;
    }
    return currentItemIndex < contextItems.length - 1 || Boolean(contextPagination?.next);
  }, [contextItems.length, contextPagination, contextReady, currentItemIndex, item]);

  /**
   * Memoized boolean indicating if navigation to the previous item is possible.
   * Considers items on the current page and the availability of a previous paginated page.
   * @type {boolean}
   */
  const canNavigatePrevious = useMemo(() => {
    if (!contextReady || !item) {
      return false;
    }
    if (currentItemIndex === -1) {
      return false;
    }
    return currentItemIndex > 0 || Boolean(contextPagination?.previous);
  }, [contextPagination, contextReady, currentItemIndex, item]);

  /**
   * Memoized object containing the current item's position and the total count within the inventory.
   * Used for displaying "X of Y" in the detail view.
   * @type {{current: number, total: number} | null}
   */
  const positionInfo = useMemo(() => {
    if (!contextReady || !item || currentItemIndex === -1 || !contextPagination) {
      return null;
    }
    return {
      current: (contextPage - 1) * PAGE_SIZE + currentItemIndex + 1,
      total: contextPagination.count,
    };
  }, [contextPage, contextPagination, contextReady, currentItemIndex, item]);

  /**
   * Navigates to a different item's scan page.
   * @param {Item | null} target - The target item to navigate to.
   */
  const handleNavigateToItem = useCallback(
    (target: Item | null) => {
      if (!target?.asset_tag) {
        setNavigationDirection(null);
        return;
      }
      setLoading(true); // Indicate loading while navigating to new item
      setError(null);
      setItem(null); // Clear current item to show loading state in ItemScanView
      navigate(`/scan/${target.asset_tag}`, { replace: true });
    },
    [navigate],
  );

  /**
   * Loads an adjacent page of items (either next or previous) to update the navigation context.
   * @param {number} targetPage - The page number to load.
   * @param {'next' | 'previous'} direction - The direction of navigation.
   */
  const loadAdjacentPage = useCallback(
    async (targetPage: number, direction: 'next' | 'previous') => {
      try {
        const response = await fetchItemsPage(targetPage);
        setContextItems(response.results);
        setContextPagination(response);
        setContextPage(targetPage);
        const targetItem =
          direction === 'next'
            ? response.results[0] ?? null
            : response.results[response.results.length - 1] ?? null;
        handleNavigateToItem(targetItem);
      } catch (err) {
        setNavigationDirection(null);
        setContextError('Inventarliste konnte nicht geladen werden.');
      }
    },
    [fetchItemsPage, handleNavigateToItem],
  );

  /**
   * Handles navigation to the next item.
   * If there's a next item on the current page, it navigates directly.
   * If not, and there's a next paginated page, it loads that page.
   */
  const handleNavigateNext = useCallback(() => {
    if (!item || !contextReady) {
      return;
    }
    if (currentItemIndex === -1) {
      return;
    }

    setNavigationDirection('next');

    if (currentItemIndex < contextItems.length - 1) {
      handleNavigateToItem(contextItems[currentItemIndex + 1]);
      return;
    }

    if (contextPagination?.next) {
      void loadAdjacentPage(contextPage + 1, 'next');
      return;
    }

    setNavigationDirection(null);
  }, [contextItems, contextPage, contextPagination, contextReady, currentItemIndex, handleNavigateToItem, item, loadAdjacentPage]);

  /**
   * Handles navigation to the previous item.
   * If there's a previous item on the current page, it navigates directly.
   * If not, and there's a previous paginated page, it loads that page.
   */
  const handleNavigatePrevious = useCallback(() => {
    if (!item || !contextReady) {
      return;
    }
    if (currentItemIndex === -1) {
      return;
    }

    setNavigationDirection('previous');

    if (currentItemIndex > 0) {
      handleNavigateToItem(contextItems[currentItemIndex - 1]);
      return;
    }

    if (contextPagination?.previous && contextPage > 1) {
      void loadAdjacentPage(contextPage - 1, 'previous');
      return;
    }

    setNavigationDirection(null);
  }, [contextItems, contextPage, contextPagination, contextReady, currentItemIndex, handleNavigateToItem, item, loadAdjacentPage]);

  /**
   * Effect to clear the navigation direction state once loading is complete.
   */
  useEffect(() => {
    if (!loading && navigationDirection) {
      setNavigationDirection(null);
    }
  }, [loading, navigationDirection]);

  return (
    <ItemScanView
      item={item}
      loading={loading}
      error={error}
      onClose={handleClose}
      onEdit={handleEdit}
      onRetry={handleRetry}
      tagMap={tagMap}
      locationMap={locationMap}
      onNavigateNext={handleNavigateNext}
      onNavigatePrevious={handleNavigatePrevious}
      canNavigateNext={canNavigateNext}
      canNavigatePrevious={canNavigatePrevious}
      navigationDirection={navigationDirection}
      positionInfo={positionInfo}
    />
  );
};

export default ScanItemPage;