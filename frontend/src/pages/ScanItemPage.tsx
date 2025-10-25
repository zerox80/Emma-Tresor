import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';

import ItemScanView from '../components/ItemScanView';
import { fetchItemByAssetTag, fetchItems, fetchLocations, fetchTags } from '../api/inventory';
import type { Item, Location, PaginatedResponse, Tag } from '../types/inventory';

type RouteParams = {
  assetTag?: string;
};

const PAGE_SIZE = 20;

/**
 * The page for viewing an item after scanning a QR code.
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
        setContextReady(false);
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

  const fetchItemsPage = useCallback(
    async (pageNumber: number) =>
      fetchItems({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        ordering: '-purchase_date',
      }),
    [],
  );

  const hasItemInCurrentPage = useMemo(() => {
    if (!item) {
      return false;
    }
    return contextItems.some((entry) => entry.id === item.id);
  }, [contextItems, item]);

  useEffect(() => {
    if (!item) {
      setContextReady(false);
      return;
    }

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
        while (true) {
          const response = await fetchItemsPage(pageNumber);
          if (!active) {
            return;
          }
          const index = response.results.findIndex((entry) => entry.id === item.id);
          if (index !== -1) {
            setContextItems(response.results);
            setContextPagination(response);
            setContextPage(pageNumber);
            break;
          }

          if (!response.next) {
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

  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag.name])),
    [tags],
  );
  const locationMap = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  const handleClose = useCallback(() => {
    navigate('/items', { replace: true });
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  const handleEdit = useCallback(() => {
    if (item) {
      navigate('/items', { state: { focusItemId: item.id } });
      return;
    }
    navigate('/items');
  }, [item, navigate]);

  const currentItemIndex = useMemo(() => {
    if (!item) {
      return -1;
    }
    return contextItems.findIndex((entry) => entry.id === item.id);
  }, [contextItems, item]);

  const canNavigateNext = useMemo(() => {
    if (!contextReady || !item) {
      return false;
    }
    if (currentItemIndex === -1) {
      return false;
    }
    return currentItemIndex < contextItems.length - 1 || Boolean(contextPagination?.next);
  }, [contextItems.length, contextPagination, contextReady, currentItemIndex, item]);

  const canNavigatePrevious = useMemo(() => {
    if (!contextReady || !item) {
      return false;
    }
    if (currentItemIndex === -1) {
      return false;
    }
    return currentItemIndex > 0 || Boolean(contextPagination?.previous);
  }, [contextPagination, contextReady, currentItemIndex, item]);

  const positionInfo = useMemo(() => {
    if (!contextReady || !item || currentItemIndex === -1 || !contextPagination) {
      return null;
    }
    return {
      current: (contextPage - 1) * PAGE_SIZE + currentItemIndex + 1,
      total: contextPagination.count,
    };
  }, [contextPage, contextPagination, contextReady, currentItemIndex, item]);

  const handleNavigateToItem = useCallback(
    (target: Item | null) => {
      if (!target?.asset_tag) {
        setNavigationDirection(null);
        return;
      }
      setLoading(true);
      setError(null);
      setItem(null);
      navigate(`/scan/${target.asset_tag}`, { replace: true });
    },
    [navigate],
  );

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
