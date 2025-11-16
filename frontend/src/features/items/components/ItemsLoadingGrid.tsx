import React from 'react';

interface ItemsLoadingGridProps {
  placeholders?: number;
}

const ItemsLoadingGrid: React.FC<ItemsLoadingGridProps> = ({ placeholders = 6 }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: placeholders }).map((_, index) => (
      <div key={index} className="h-40 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
    ))}
  </div>
);

export default ItemsLoadingGrid;
