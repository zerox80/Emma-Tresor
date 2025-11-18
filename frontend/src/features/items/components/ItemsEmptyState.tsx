import React from 'react';

import Button from '../../../components/common/Button';

interface ItemsEmptyStateProps {
  onCreateItem: () => void;
}

const ItemsEmptyState: React.FC<ItemsEmptyStateProps> = ({ onCreateItem }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-500">
      []
    </div>
    <h4 className="mt-4 text-xl font-semibold text-slate-900">Noch keine Gegenstände erfasst</h4>
    <p className="mt-2 text-sm text-slate-500">
      Lege deinen ersten Gegenstand an und starte deine Inventarliste. Alles ist in wenigen Schritten erledigt.
    </p>
    <div className="mt-4 flex justify-center">
      <Button variant="primary" size="md" onClick={onCreateItem}>
        Jetzt starten
      </Button>
    </div>
  </div>
);

export default ItemsEmptyState;
