import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Button from './common/Button';
import { fetchItemQrCode } from '../api/inventory';
import type { Item } from '../types/inventory';

interface ItemDetailViewProps {
  item: Item | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onRetry?: () => void;
  tagMap: Record<number, string>;
  locationMap: Record<number, string>;
}

const ItemDetailView: React.FC<ItemDetailViewProps> = ({
  item,
  loading,
  error,
  onClose,
  onEdit,
  onRetry,
  tagMap,
  locationMap,
}) => {
  type QrPreview = {
    url: string;
    revokable: boolean;
  };

  const [qrPreview, setQrPreview] = useState<QrPreview | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrReloadToken, setQrReloadToken] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const qrPreviewRef = useRef<QrPreview | null>(null);

  const releaseQrPreview = useCallback((preview: QrPreview | null) => {
    if (preview?.revokable) {
      URL.revokeObjectURL(preview.url);
    }
  }, []);

  const clearQrPreview = useCallback(() => {
    setQrPreview((previous) => {
      releaseQrPreview(previous);
      return null;
    });
  }, [releaseQrPreview]);

  const setQrPreviewValue = useCallback(
    (preview: QrPreview) => {
      setQrPreview((previous) => {
        releaseQrPreview(previous);
        return preview;
      });
    },
    [releaseQrPreview],
  );

  const formatCurrency = (value: string | null) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return '—';
    }
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const shareLink = useMemo(() => {
    if (!item) {
      return '';
    }
    return `${window.location.origin}/scan/${item.asset_tag}`;
  }, [item]);

  const generateFallbackQr = useCallback(async () => {
    if (!shareLink) {
      return false;
    }
    try {
      const dataUrl = await QRCode.toDataURL(shareLink, {
        width: 480,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      setQrPreviewValue({ url: dataUrl, revokable: false });
      return true;
    } catch (error) {
      console.error('Failed to generate fallback QR code', error);
      return false;
    }
  }, [shareLink, setQrPreviewValue]);

  useEffect(() => (
    () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  ), []);

  useEffect(() => {
    qrPreviewRef.current = qrPreview;
  }, [qrPreview]);

  useEffect(
    () => () => {
      releaseQrPreview(qrPreviewRef.current);
    },
    [releaseQrPreview],
  );

  useEffect(() => {
    let active = true;

    clearQrPreview();

    if (!item) {
      setQrLoading(false);
      setQrError(null);
      return;
    }

    const loadQrCode = async () => {
      setQrLoading(true);
      setQrError(null);
      try {
        const blob = await fetchItemQrCode(item.id);
        if (!active) {
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        setQrPreviewValue({ url: objectUrl, revokable: true });
      } catch (qrFetchError) {
        console.error('Failed to load QR code', qrFetchError);
        if (!active) {
          return;
        }
        const fallbackOk = await generateFallbackQr();
        if (fallbackOk) {
          setQrError('Server-QR-Code nicht verfügbar. Lokale Version wird angezeigt.');
        } else {
          setQrError('QR-Code konnte nicht geladen werden. Bitte versuche es erneut.');
        }
      } finally {
        if (active) {
          setQrLoading(false);
        }
      }
    };

    void loadQrCode();

    return () => {
      active = false;
    };
  }, [item, qrReloadToken, clearQrPreview, setQrPreviewValue, generateFallbackQr]);

  const handleRefreshQr = useCallback(() => {
    setQrReloadToken((prev) => prev + 1);
  }, []);

  const handleDownloadQr = useCallback(async () => {
    if (!item) {
      return;
    }
    setDownloadLoading(true);
    try {
      const blob = await fetchItemQrCode(item.id, { download: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `item-${item.id}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error('Failed to download QR code', downloadError);
      try {
        if (!qrPreviewRef.current) {
          const fallbackCreated = await generateFallbackQr();
          if (!fallbackCreated) {
            throw downloadError;
          }
        }

        const sourceUrl = qrPreviewRef.current?.url;
        if (!sourceUrl) {
          throw downloadError;
        }

        const response = await fetch(sourceUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `item-${item.id}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setQrError('Server-QR-Code nicht verfügbar. Lokale Version wurde heruntergeladen.');
      } catch (fallbackError) {
        console.error('Failed to download fallback QR code', fallbackError);
        setQrError('QR-Code konnte nicht heruntergeladen werden. Bitte versuche es erneut.');
      }
    } finally {
      setDownloadLoading(false);
    }
  }, [item, generateFallbackQr]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopySuccess(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (copyError) {
      console.error('Failed to copy share link', copyError);
      setQrError('Link konnte nicht in die Zwischenablage kopiert werden.');
    }
  }, [shareLink]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-heading"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 id="item-detail-heading" className="text-2xl font-semibold text-slate-900">
              {loading ? 'Lade Details...' : item?.name || 'Gegenstand Details'}
            </h3>
            <p className="text-sm text-slate-600">
              Vollständige Ansicht des Inventargegenstands
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600 mx-auto"></div>
              <p className="text-slate-600">Lade Gegenstand-Details...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="mb-4 text-red-700">{error}</p>
            {onRetry && (
              <Button type="button" variant="secondary" onClick={onRetry}>
                Erneut versuchen
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        {!loading && !error && item && (
          <div className="space-y-8">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="flex w-full justify-center lg:w-auto">
                  <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    {qrLoading && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-500">
                        <span className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
                        <span>QR-Code wird erstellt …</span>
                      </div>
                    )}
                    {!qrLoading && qrPreview?.url && (
                      <img src={qrPreview.url} alt={`QR-Code für ${item.name}`} className="h-full w-full object-contain" />
                    )}
                    {!qrLoading && !qrPreview?.url && !qrError && (
                      <div className="text-center text-sm text-slate-500">
                        QR-Code wird vorbereitet …
                      </div>
                    )}
                    {!qrLoading && qrError && !qrPreview?.url && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-red-500">
                        <span>QR-Code konnte nicht geladen werden.</span>
                        <Button type="button" variant="secondary" size="sm" onClick={handleRefreshQr}>
                          Erneut versuchen
                        </Button>
                      </div>
                    )}
                    {!qrLoading && qrError && qrPreview?.url && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-amber-500">
                        <span>{qrError}</span>
                        <Button type="button" variant="secondary" size="sm" onClick={handleRefreshQr}>
                          Erneut versuchen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">QR-Code für schnellen Zugriff</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Scanne den Code, um diesen Gegenstand sofort zu öffnen. Teile den Link mit deinem Team oder drucke den Code für dein Inventar aus.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleDownloadQr}
                      loading={downloadLoading}
                      disabled={!item || (!qrPreview && qrError !== null && !qrLoading)}
                    >
                      QR-Code herunterladen
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyShareLink}
                      disabled={!shareLink}
                    >
                      Link kopieren
                    </Button>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Direktlink</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{shareLink || '—'}</p>
                    {copySuccess && <p className="mt-2 text-xs text-emerald-600">Link in Zwischenablage kopiert.</p>}
                    {qrError && !qrLoading && !qrPreview?.url && (
                      <p className="mt-2 text-xs text-red-500">{qrError}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Images Section */}
            {item.images && item.images.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Bilder</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {item.images.map((image, index) => (
                    <div key={index} className="overflow-hidden rounded-lg bg-white shadow-sm">
                      <img
                        src={typeof image === 'string' ? image : image.image}
                        alt={`${item.name} - Bild ${index + 1}`}
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-slate-500">Keine Bilder verfügbar</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Basic Information */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Grundinformationen</h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Name</dt>
                    <dd className="mt-1 text-sm text-slate-900">{item.name}</dd>
                  </div>
                  {item.description && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Beschreibung</dt>
                      <dd className="mt-1 text-sm text-slate-900">{item.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Menge</dt>
                    <dd className="mt-1 text-sm text-slate-900">{item.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Wert</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</dd>
                  </div>
                  {item.purchase_date && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Kaufdatum</dt>
                      <dd className="mt-1 text-sm text-slate-900">{formatDate(item.purchase_date)}</dd>
                    </div>
                  )}
                  {item.asset_tag && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Asset-Tag</dt>
                      <dd className="mt-1 text-sm font-mono text-slate-900">{item.asset_tag}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Location and Tags */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">Zuordnung</h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Standort</dt>
                    <dd className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {locationMap[item.location ?? 0] ?? 'Kein Standort'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Tags</dt>
                    <dd className="mt-1">
                      {item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tagId) => (
                            <span
                              key={tagId}
                              className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800"
                            >
                              {tagMap[tagId] ?? `Tag ${tagId}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Keine Tags zugewiesen</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Audit Log Section (Placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h4 className="mb-4 text-lg font-semibold text-slate-900">Änderungshistorie</h4>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-900">Dieses Feature wird bald verfügbar sein</p>
                <p className="mt-1 text-sm text-slate-500">
                  Hier werden zukünftig alle Änderungen an diesem Gegenstand protokolliert.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!loading && !error && item && (
          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Schließen
            </Button>
            <Button type="button" variant="primary" onClick={onEdit}>
              Bearbeiten
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDetailView;
