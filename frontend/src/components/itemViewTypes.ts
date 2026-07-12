import type { Item } from "../types/inventory";

export interface DetailPositionInfo {
  current: number;
  total: number;
}

export interface ItemViewProps {
  item: Item | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  deleteLoading?: boolean;
  deleteError?: string | null;
  tagMap: Record<number, string>;
  locationMap: Record<number, string>;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrevious?: boolean;
  canNavigateNext?: boolean;
  navigationDirection?: "next" | "previous" | null;
  positionInfo?: DetailPositionInfo | null;
}
