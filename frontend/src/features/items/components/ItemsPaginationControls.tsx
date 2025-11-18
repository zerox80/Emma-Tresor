import React from 'react';

import Button from '../../../components/common/Button';
import type { PaginatedResponse } from '../../../types/inventory';

interface ItemsPaginationControlsProps {
  page: number;
  pagination: PaginatedResponse<unknown> | null;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const ItemsPaginationControls: React.FC<ItemsPaginationControlsProps> = ({
  page,
  pagination,
  loading,
  onPrevious,
  onNext,
}) => {
  if (!pagination || (!pagination.next && !pagination.previous)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <span>
        Seite {page} - {pagination.count} Ergebnisse insgesamt
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPrevious}
          disabled={!pagination.previous || page === 1 || loading}
        >
          Zurueck
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={onNext} disabled={!pagination.next || loading}>
          Weiter
        </Button>
      </div>
    </div>
  );
};

export default ItemsPaginationControls;
