import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createItem } from "../../../test/itemFixture";
import { useItemSelection } from "./useItemSelection";

describe("useItemSelection", () => {
  it("selects the current page without dropping selections from other pages", () => {
    const firstPage = [createItem(1), createItem(2)];
    const { result, rerender } = renderHook(
      ({ items }) => useItemSelection(items),
      { initialProps: { items: firstPage } },
    );

    act(() => {
      result.current.setSelectionMode(true);
      result.current.toggleItemSelected(99);
      result.current.selectAllCurrentPage();
    });
    expect(result.current.selectedItemIds).toEqual([99, 1, 2]);
    expect(result.current.areAllSelectedOnPage).toBe(true);

    rerender({ items: [createItem(3)] });
    act(() => result.current.selectAllCurrentPage());
    expect(result.current.selectedItemIds).toEqual([99, 1, 2, 3]);

    act(() => result.current.toggleSelectionMode());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedItemIds).toEqual([]);
  });
});
