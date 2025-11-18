import type { DuplicateFinderParams } from '../../api/inventory';

export const ITEMS_PAGE_SIZE = 20;

export type ViewMode = 'grid' | 'table';

export const DEFAULT_ITEM_ORDERING = '-purchase_date';

export type DuplicateStrictnessLevel = 'relaxed' | 'balanced' | 'strict';

export interface DuplicateStrictnessOption {
  id: DuplicateStrictnessLevel;
  label: string;
  description: string;
  params: DuplicateFinderParams;
}

export const DUPLICATE_STRICTNESS_OPTIONS: DuplicateStrictnessOption[] = [
  {
    id: 'relaxed',
    label: 'Locker',
    description: 'Grober Vergleich (enthält) und großes Kaufdatumsfenster',
    params: {
      name_match: 'contains',
      description_match: 'contains',
      purchase_date_tolerance_days: 90,
    },
  },
  {
    id: 'balanced',
    label: 'Mittel',
    description: 'Prefix-Abgleich & mittleres Kaufdatumsfenster',
    params: {
      name_match: 'prefix',
      description_match: 'contains',
      wodis_match: 'none',
      purchase_date_tolerance_days: 30,
    },
  },
  {
    id: 'strict',
    label: 'Streng',
    description: 'Exakter Name/Beschreibung & enges Kaufdatumsfenster',
    params: {
      name_match: 'exact',
      description_match: 'exact',
      wodis_match: 'exact',
      purchase_date_tolerance_days: 7,
    },
  },
];

export const DEFAULT_DUPLICATE_STRICTNESS: DuplicateStrictnessLevel = 'balanced';
