import { useCallback, useState } from 'react';

import { createList, fetchLists } from '../../../api/inventory';
import type { ItemList } from '../../../types/inventory';
import { sortItemLists } from '../utils/itemHelpers';

interface UseItemListsResult {
  lists: ItemList[];
  listsLoading: boolean;
  listsError: string | null;
  listsInitialized: boolean;
  loadLists: () => Promise<void>;
  maybeLoadLists: () => Promise<void>;
  upsertList: (target: ItemList) => void;
  createNewList: (name: string) => Promise<ItemList>;
}

export const useItemLists = (): UseItemListsResult => {
  const [lists, setLists] = useState<ItemList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [listsInitialized, setListsInitialized] = useState(false);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    setListsError(null);
    try {
      const fetchedLists = await fetchLists();
      setLists(sortItemLists(fetchedLists));
      setListsInitialized(true);
    } catch (error) {
      setListsError('Deine Listen konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setListsLoading(false);
    }
  }, []);

  const maybeLoadLists = useCallback(async () => {
    if (listsInitialized || listsLoading) {
      return;
    }
    await loadLists();
  }, [listsInitialized, listsLoading, loadLists]);

  const upsertList = useCallback((target: ItemList) => {
    setLists((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === target.id);
      if (existingIndex === -1) {
        return sortItemLists([...prev, target]);
      }
      const next = [...prev];
      next[existingIndex] = target;
      return sortItemLists(next);
    });
    setListsInitialized(true);
  }, []);

  const createNewList = useCallback(async (name: string) => {
    const newList = await createList(name);
    setLists((prev) => sortItemLists([...prev, newList]));
    setListsInitialized(true);
    return newList;
  }, []);

  return {
    lists,
    listsLoading,
    listsError,
    listsInitialized,
    loadLists,
    maybeLoadLists,
    upsertList,
    createNewList,
  };
};
