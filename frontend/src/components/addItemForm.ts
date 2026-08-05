import { z } from "zod";
import type { ItemPayload } from "../types/inventory";

/**
 * Converts the German decimal separator to the API's canonical format.
 * Empty optional values remain null so they are omitted by the backend.
 */
export const normaliseCurrencyValue = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.replace(",", ".") : null;
};

const optionalCurrencyValue = z
  .string()
  .optional()
  .refine(
    (value) => {
      const normalised = normaliseCurrencyValue(value);
      return normalised === null || /^-?\d+(?:\.\d+)?$/.test(normalised);
    },
    "Bitte gib einen gültigen Wert ein, z. B. 1,84.",
  )
  .refine(
    (value) => {
      const normalised = normaliseCurrencyValue(value);
      return normalised === null || Number(normalised) >= 0;
    },
    "Der Wert darf nicht negativ sein.",
  )
  .refine(
    (value) => {
      const decimalPart = normaliseCurrencyValue(value)?.split(".")[1];
      return !decimalPart || decimalPart.length <= 2;
    },
    "Der Wert darf maximal 2 Nachkommastellen haben, z. B. 1,84.",
  )
  .refine(
    (value) => {
      const normalised = normaliseCurrencyValue(value);
      return normalised === null || Number(normalised) <= 999999999.99;
    },
    "Der Wert ist zu hoch. Maximal 999.999.999,99 € erlaubt.",
  );

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(255, "Name darf höchstens 255 Zeichen enthalten."),
  description: z.string().max(2000, "Die Beschreibung ist zu lang (maximal 2000 Zeichen).").optional(),
  wodis_inventory_number: z
    .string()
    .max(120, "Wodis Inventarnummer darf maximal 120 Zeichen enthalten.")
    .optional(),
  quantity: z
    .number({ error: "Menge muss eine Zahl sein." })
    .finite("Menge muss eine Zahl sein.")
    .int("Menge muss eine ganze Zahl sein.")
    .min(1, "Menge muss mindestens 1 sein."),
  purchase_date: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Bitte gib ein gültiges Datum an (JJJJ-MM-TT).",
    ),
  value: optionalCurrencyValue,
  location: z.number().nullable().optional(),
  tags: z.array(z.number()).optional(),
  employee_name: z.string().max(255, "Mitarbeiter Name darf maximal 255 Zeichen enthalten.").optional(),
  room_number: z.string().max(50, "Raum Nr darf maximal 50 Zeichen enthalten.").optional(),
});

export type ItemFormSchema = z.infer<typeof itemSchema>;
export type StepIndex = 0 | 1 | 2;

export const DEFAULT_VALUES: ItemFormSchema = {
  name: "",
  description: "",
  wodis_inventory_number: "",
  quantity: 1,
  purchase_date: "",
  value: "",
  location: null,
  tags: [],
  employee_name: "",
  room_number: "",
};

export const STEP_FIELD_MAP: (keyof ItemFormSchema)[][] = [
  ["name", "wodis_inventory_number", "quantity", "purchase_date", "value"],
  ["location", "tags", "employee_name", "room_number"],
  [],
];

export const normaliseItemPayload = (values: ItemFormSchema): ItemPayload => {
  const optional = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    name: values.name.trim(),
    description: optional(values.description),
    quantity: values.quantity,
    purchase_date: optional(values.purchase_date),
    value: normaliseCurrencyValue(values.value),
    location: values.location ?? null,
    wodis_inventory_number: optional(values.wodis_inventory_number),
    tags: values.tags ?? [],
    employee_name: optional(values.employee_name),
    room_number: optional(values.room_number),
  };
};

export const formatItemFormCurrency = (value: string | undefined) => {
  const numeric = Number.parseFloat(normaliseCurrencyValue(value) ?? "");
  if (!Number.isFinite(numeric) || numeric < 0) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(numeric);
};

export const formatItemFormDate = (value: string | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};
