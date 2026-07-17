import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchItems, fetchItemStats } from "../../../api/inventory";
import type { PaginatedResponse, Item } from "../../../types/inventory";
import { createItem, createPage } from "../../../test/itemFixture";
import { useItemsData } from "./useItemsData";

vi.mock("../../../api/inventory", () => ({
  fetchItems: vi.fn(),
  fetchItemStats: vi.fn(),
}));

const deferredPage = () => {
  let resolve!: (page: PaginatedResponse<Item>) => void;
  const promise = new Promise<PaginatedResponse<Item>>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("useItemsData", () => {
  it("keeps the newest response when requests finish out of order", async () => {
    const first = deferredPage();
    const second = deferredPage();
    vi.mocked(fetchItemStats).mockResolvedValue({
      total_items: 1,
      total_quantity: 1,
      total_value: "1.00",
    });
    vi.mocked(fetchItems)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() =>
      useItemsData({
        debouncedSearchTerm: "",
        ordering: "name",
        page: 1,
        selectedLocationIds: [],
        selectedTagIds: [],
      }),
    );

    let firstLoad!: Promise<void>;
    let secondLoad!: Promise<void>;
    act(() => {
      firstLoad = result.current.loadItems();
      secondLoad = result.current.loadItems();
    });

    second.resolve(createPage([createItem(2, "Newest")]));
    await act(async () => secondLoad);
    expect(result.current.items.map((item) => item.name)).toEqual(["Newest"]);
    expect(result.current.itemsVersion).toBe(1);

    first.resolve(createPage([createItem(1, "Stale")]));
    await act(async () => firstLoad);
    expect(result.current.items.map((item) => item.name)).toEqual(["Newest"]);
    expect(result.current.loadingItems).toBe(false);
    expect(result.current.itemsVersion).toBe(1);
  });
});
