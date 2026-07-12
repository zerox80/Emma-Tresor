import React, { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";

import Button from "../components/common/Button";
import ManageListItemsSheet, {
  type ManageableItem,
} from "../components/ManageListItemsSheet";
import {
  fetchAllItems,
  fetchLists,
  createList,
  updateListItems,
  deleteList,
  exportListItems,
} from "../api/inventory";
import type { Item, ItemList } from "../types/inventory";
import ListsContent from "./ListsContent";

export interface ListWithItems extends ItemList {
  resolvedItems: Item[];
}

const ListsPage: React.FC = () => {
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [manageListTarget, setManageListTarget] =
    useState<ListWithItems | null>(null);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingListId, setExportingListId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const [listsResponse, items] = await Promise.all([
          fetchLists(),
          fetchAllItems(),
        ]);
        if (!isMounted) {
          return;
        }
        setAllItems(items);
        const itemMap = new Map<number, Item>(
          items.map((item: Item) => [item.id, item]),
        );
        const mappedLists: ListWithItems[] = listsResponse.map(
          (list: ItemList): ListWithItems => ({
            ...list,
            resolvedItems: list.items
              .map((itemId: number) => itemMap.get(itemId))
              .filter((entry?: Item): entry is Item => Boolean(entry)),
          }),
        );
        setLists(mappedLists);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(
          "Die Listen konnten nicht synchronisiert werden. Prüfe deine Verbindung und versuche es in Kürze erneut.",
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadLists();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listsResponse, items] = await Promise.all([
        fetchLists(),
        fetchAllItems(),
      ]);
      setAllItems(items);
      const itemMap = new Map<number, Item>(
        items.map((item: Item) => [item.id, item]),
      );
      const mappedLists: ListWithItems[] = listsResponse.map(
        (list: ItemList): ListWithItems => ({
          ...list,
          resolvedItems: list.items
            .map((itemId: number) => itemMap.get(itemId))
            .filter((entry?: Item): entry is Item => Boolean(entry)),
        }),
      );
      setLists(mappedLists);
      setError(null);
    } catch (err) {
      setError(
        "Aktualisieren fehlgeschlagen. Bitte versuche es gleich erneut.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setCreateError("Listenname ist erforderlich.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const newList = await createList(newListName.trim());
      const listWithItems: ListWithItems = {
        ...newList,
        resolvedItems: [],
      };
      setLists((prev) => [...prev, listWithItems]);
      setShowCreateModal(false);
      setNewListName("");
    } catch (err) {
      setCreateError(
        "Liste konnte nicht erstellt werden. Bitte versuche es erneut.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setNewListName("");
    setCreateError(null);
  };

  const itemMap = useMemo(
    () => new Map<number, Item>(allItems.map((item: Item) => [item.id, item])),
    [allItems],
  );

  const manageableItems = useMemo<ManageableItem[]>(() => {
    const assignmentCountMap = new Map<number, number>();
    lists.forEach((list: ListWithItems) => {
      list.items.forEach((itemId: number) => {
        assignmentCountMap.set(
          itemId,
          (assignmentCountMap.get(itemId) ?? 0) + 1,
        );
      });
    });

    return allItems.map((item: Item) => ({
      ...item,
      assignmentCount: assignmentCountMap.get(item.id) ?? 0,
    }));
  }, [allItems, lists]);

  const handleOpenManageItems = (listId: number) => {
    const target = lists.find((list) => list.id === listId);
    if (!target) {
      return;
    }
    setManageListTarget(target);
    setManageError(null);
  };

  const handleCloseManageItems = () => {
    if (manageSaving) {
      return;
    }
    setManageListTarget(null);
    setManageError(null);
  };

  const handleSaveManageItems = async (itemIds: number[]) => {
    if (!manageListTarget) {
      return;
    }

    setManageSaving(true);
    setManageError(null);
    try {
      const updated = await updateListItems(manageListTarget.id, itemIds);
      const resolvedItems = updated.items
        .map((itemId: number) => itemMap.get(itemId))
        .filter((entry?: Item): entry is Item => Boolean(entry));

      setLists((prev: ListWithItems[]) =>
        prev.map((list: ListWithItems) =>
          list.id === updated.id
            ? {
                ...list,
                items: updated.items,
                resolvedItems,
              }
            : list,
        ),
      );

      setManageListTarget(null);
      setManageError(null);
    } catch (err) {
      const axiosError = err as AxiosError;
      const fallback =
        axiosError.response?.data &&
        typeof axiosError.response.data === "object"
          ? (axiosError.response.data as { detail?: string }).detail
          : null;
      setManageError(
        fallback ?? "Änderungen konnten nicht gespeichert werden.",
      );
    } finally {
      setManageSaving(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (deletingListId !== null) {
      return;
    }

    const target = lists.find((list) => list.id === listId);
    if (!target) {
      return;
    }

    let confirmed = true;
    if (typeof window !== "undefined") {
      confirmed = window.confirm(
        `Liste "${target.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      );
    }
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingListId(listId);
    try {
      await deleteList(listId);
      setLists((prev: ListWithItems[]) =>
        prev.filter((list: ListWithItems) => list.id !== listId),
      );
      if (manageListTarget?.id === listId) {
        setManageListTarget(null);
        setManageError(null);
      }
    } catch (err) {
      const axiosError = err as AxiosError;
      const fallback =
        axiosError.response?.data &&
        typeof axiosError.response.data === "object"
          ? (axiosError.response.data as { detail?: string }).detail
          : null;
      setDeleteError(
        fallback ??
          "Liste konnte nicht gelöscht werden. Bitte versuche es erneut.",
      );
    } finally {
      setDeletingListId(null);
    }
  };

  const handleExportList = async (listId: number, listName: string) => {
    setExportError(null);
    setExportingListId(listId);
    try {
      const blob = await exportListItems(listId);
      const url = URL.createObjectURL(blob);
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
      const filename = `inventarliste-${safeName || fallbackName}-${timestamp}.csv`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const axiosError = err as AxiosError;
      const fallback =
        axiosError.response?.data &&
        typeof axiosError.response.data === "object"
          ? (axiosError.response.data as { detail?: string }).detail
          : null;
      setExportError(
        fallback ??
          "Export der Liste fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setExportingListId(null);
    }
  };

  return (
    <ListsContent
      lists={lists}
      loading={loading}
      error={error}
      handleRefresh={handleRefresh}
      setShowCreateModal={setShowCreateModal}
      handleOpenManageItems={handleOpenManageItems}
      exportingListId={exportingListId}
      handleExportList={handleExportList}
      deletingListId={deletingListId}
      handleDeleteList={handleDeleteList}
      deleteError={deleteError}
      exportError={exportError}
      setExportError={setExportError}
      showCreateModal={showCreateModal}
      handleCancelCreate={handleCancelCreate}
      createError={createError}
      newListName={newListName}
      setNewListName={setNewListName}
      isCreating={isCreating}
      handleCreateList={handleCreateList}
      manageListTarget={manageListTarget}
      handleCloseManageItems={handleCloseManageItems}
      manageableItems={manageableItems}
      manageSaving={manageSaving}
      manageError={manageError}
      handleSaveManageItems={handleSaveManageItems}
    />
  );
};

export default ListsPage;
