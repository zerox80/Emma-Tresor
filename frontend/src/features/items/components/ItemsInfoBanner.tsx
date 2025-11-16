import React from 'react';

interface ItemsInfoBannerProps {
  message: string;
  onDismiss: () => void;
}

const ItemsInfoBanner: React.FC<ItemsInfoBannerProps> = ({ message, onDismiss }) => (
  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
    <div className="flex items-start justify-between gap-3">
      <span>{message}</span>
      <button
        type="button"
        className="text-emerald-600 transition hover:text-emerald-800"
        onClick={onDismiss}
        aria-label="Hinweis schließen"
      >
        &times;
      </button>
    </div>
  </div>
);

export default ItemsInfoBanner;
