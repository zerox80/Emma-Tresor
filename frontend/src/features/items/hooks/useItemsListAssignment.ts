import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AxiosError } from "axios";

import { updateListItems } from "../../../api/inventory";
import type { ItemList } from "../../../types/inventory";
import { extractDetailMessage } from "../utils/itemHelpers";
import { useItemLists } from "./useItemLists";

interface UseItemsListAssignmentArgs {
  clearSelection: () => void;
  selectedItemIds: number[];
  setInfoMessage: Dispatch<SetStateAction<string | null>>;
  setSelectionMode: Dispatch<SetStateAction<boolean>>;
}

export const useItemsListAssignment = ({
  clearSelection,
  selectedItemIds,
  setInfoMessage,
  setSelectionMode,
}: UseItemsListAssignmentArgs) => {
  const listsController = useItemLists();
  const [isOpen, setIsOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAssignError(null);
      void listsController.maybeLoadLists();
    }
  }, [isOpen, listsController.maybeLoadLists]);

  const open = useCallback(() => {
    setIsOpen(true);
    void listsController.maybeLoadLists();
  }, [listsController.maybeLoadLists]);

  const close = useCallback(() => {
    if (!assignLoading) {
      setIsOpen(false);
      setAssignError(null);
    }
  }, [assignLoading]);

  const assign = useCallback(
    async (listId: number) => {
      if (selectedItemIds.length === 0) {
        throw new Error("Bitte wähle mindestens einen Gegenstand aus.");
      }

      setAssignLoading(true);
      setAssignError(null);
      try {
        const target =
          listsController.lists.find((list) => list.id === listId) ?? null;
        const mergedIds = new Set<number>(target?.items ?? []);
        selectedItemIds.forEach((id) => mergedIds.add(id));
        const updated = await updateListItems(listId, Array.from(mergedIds));
        listsController.upsertList(updated);
        setInfoMessage(
          `${selectedItemIds.length} Gegenstände wurden zu ` +
            `"${updated.name}" hinzugefügt.`,
        );
        setIsOpen(false);
        setSelectionMode(false);
        clearSelection();
      } catch (error) {
        const message =
          extractDetailMessage(error as AxiosError) ??
          "Zuweisung fehlgeschlagen. Bitte versuche es erneut.";
        setAssignError(message);
        throw new Error(message);
      } finally {
        setAssignLoading(false);
      }
    },
    [
      clearSelection,
      listsController,
      selectedItemIds,
      setInfoMessage,
      setSelectionMode,
    ],
  );

  const createList = useCallback(
    (name: string): Promise<ItemList> => listsController.createNewList(name),
    [listsController.createNewList],
  );

  return {
    ...listsController,
    isOpen,
    open,
    close,
    assign,
    assignLoading,
    assignError,
    createList,
  };
};
