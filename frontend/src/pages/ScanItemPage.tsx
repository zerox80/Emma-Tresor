import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';

import ItemDetailView from '../components/ItemDetailView';
import { fetchItemByAssetTag, fetchLocations, fetchTags } from '../api/inventory';
import type { Item, Location, Tag } from '../types/inventory';

type RouteParams = {
  assetTag?: string;
};

const ScanItemPage: React.FC = () => {
  const { assetTag } = useParams<RouteParams>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

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
      } catch (err) {
        console.error('Failed to load item via QR scan', err);
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

  return (
    <ItemDetailView
      item={item}
      loading={loading}
      error={error}
      onClose={handleClose}
      onEdit={handleEdit}
      onRetry={handleRetry}
      tagMap={tagMap}
      locationMap={locationMap}
    />
  );
};

export default ScanItemPage;
