import { describe, expect, it } from "vitest";

import {
  formatItemFormCurrency,
  itemSchema,
  normaliseItemPayload,
} from "./addItemForm";

describe("add item form helpers", () => {
  it("normalises whitespace and optional values for the API", () => {
    const values = itemSchema.parse({
      name: "  Notebook  ",
      description: "   ",
      wodis_inventory_number: " W-42 ",
      quantity: 2,
      purchase_date: "2026-07-12",
      value: " 19.95 ",
      location: undefined,
      tags: undefined,
      employee_name: " Emma ",
      room_number: " 101 ",
    });

    expect(normaliseItemPayload(values)).toEqual({
      name: "Notebook",
      description: null,
      quantity: 2,
      purchase_date: "2026-07-12",
      value: "19.95",
      location: null,
      wodis_inventory_number: "W-42",
      tags: [],
      employee_name: "Emma",
      room_number: "101",
    });
  });

  it("rejects invalid quantities and dates", () => {
    const result = itemSchema.safeParse({
      name: "Notebook",
      quantity: 0,
      purchase_date: "12.07.2026",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "quantity",
        "purchase_date",
      ]);
    }
  });

  it("formats valid currency values and rejects unusable input", () => {
    expect(formatItemFormCurrency("19.95")).toContain("19,95");
    expect(formatItemFormCurrency("-1")).toBe("—");
    expect(formatItemFormCurrency("invalid")).toBe("—");
  });
});
