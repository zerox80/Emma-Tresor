import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Button from './common/Button';
import { fetchItemQrCode } from '../api/inventory';
import type { Item } from '../types/inventory';
import { apiBaseUrl } from '../api/client';

interface DetailPositionInfo {
  current: number;
  total: number;
}

interface ItemDetailViewProps {
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
  navigationDirection?: 'next' | 'previous' | null;
  positionInfo?: DetailPositionInfo | null;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ItemDetailView: React.FC<ItemDetailViewProps> = ({
  item,
  loading,
  error,
  onClose,
  onEdit,
  onRetry,
  onDelete,
  deleteLoading = false,
  deleteError = null,
  tagMap,
  locationMap,
  onNavigatePrevious,
  onNavigateNext,
  canNavigatePrevious = false,
  canNavigateNext = false,
  navigationDirection = null,
  positionInfo = null,
}) => {
  type QrPreview = {
    url: string;
    revokable: boolean;
  };

  const [qrPreview, setQrPreview] = useState<QrPreview | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrReloadToken, setQrReloadToken] = useState(0);
  const [qrDownloadLoading, setQrDownloadLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const qrPreviewRef = useRef<QrPreview | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | number | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLDivElement | null>(null);
  const navigationLockRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchNavigatedRef = useRef(false);

  const canDelete = typeof onDelete === 'function';

  const showNavigation = Boolean(onNavigatePrevious || onNavigateNext);
  const isNavigatingNext = navigationDirection === 'next';
  const isNavigatingPrevious = navigationDirection === 'previous';
  const previousDisabled = !onNavigatePrevious || !canNavigatePrevious || loading || isNavigatingPrevious;
  const nextDisabled = !onNavigateNext || !canNavigateNext || loading || isNavigatingNext;

  const getFocusableElements = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return [] as HTMLElement[];
    }
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => {
        // Check if element is disabled via attribute
        if (element.hasAttribute('disabled')) {
          return false;
        }

        // Check if element is disabled via CSS (pointer-events: none)
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.pointerEvents === 'none') {
          return false;
        }

        // Check if element has aria-hidden
        if (element.getAttribute('aria-hidden') === 'true') {
          return false;
        }

        // Check if element is hidden via CSS
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
          return false;
        }

        return true;
      },
    );
  }, []);

  const apiMediaBase = useMemo(() => {
    try {
      const base = apiBaseUrl.replace(/\/@?api(?:\/)?$/i, '/');
      const url = new URL(base);
      const result = url.toString().replace(/\/$/, '');
      return result + '/';
    } catch (error) {
      if (typeof window !== 'undefined') {
        return `${window.location.origin}/`;
      }
      return apiBaseUrl;
    }
  }, []);

  type AttachmentView = {
    key: string | number;
    previewUrl: string;
    downloadUrl: string;
    name: string;
    extension: string;
    type: 'image' | 'pdf' | 'file';
  };

  const attachments = useMemo<AttachmentView[]>(() => {
    if (!item?.images) {
      return [];
    }

    return item.images.map((attachment, index) => {
      if (typeof attachment === 'string') {
        return {
          key: `img-${index}`,
          previewUrl: attachment,
          downloadUrl: attachment,
          name: `Datei-${index + 1}`,
          extension: attachment.split('.').pop()?.toLowerCase() ?? '',
          type: attachment.endsWith('.pdf') ? 'pdf' : 'image',
        };
      }

      const name = attachment.filename || `Datei-${index + 1}`;
      const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
      const type = extension === 'pdf' ? 'pdf' : attachment.content_type?.startsWith('image/') ? 'image' : 'file';

      return {
        key: attachment.id ?? `img-${index}`,
        previewUrl: attachment.preview_url,
        downloadUrl: attachment.download_url,
        name,
        extension,
        type,
      };
    });
  }, [item]);

  const deleteConfirmTitleId = useMemo(
    () => (item ? `item-delete-confirm-${item.id}` : 'item-delete-confirm'),
    [item],
  );

  const deleteConfirmDescriptionId = useMemo(
    () => `${deleteConfirmTitleId}-description`,
    [deleteConfirmTitleId],
  );

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
    if (!item?.asset_tag) {
      return '';
    }

    const encodedAssetTag = encodeURIComponent(item.asset_tag);

    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return new URL(`scan/${encodedAssetTag}`, `${window.location.origin}/`).toString();
      }
    } catch (error) {
      // Ignore and try fallback below
    }

    try {
      return new URL(`scan/${encodedAssetTag}`, apiMediaBase).toString();
    } catch (fallbackError) {
      return `scan/${encodedAssetTag}`;
    }
  }, [item, apiMediaBase]);

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
    if (!item) {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
      setCopySuccess(false);
      setAttachmentError(null);
    }
  }, [item]);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [item, canDelete]);

  useEffect(() => {
    if (!confirmingDelete) {
      return;
    }
    const timer = window.setTimeout(() => {
      confirmDeleteRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => {
      window.clearTimeout(timer);
    };
  }, [confirmingDelete]);

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
    setQrDownloadLoading(true);
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
        setQrError('QR-Code konnte nicht heruntergeladen werden. Bitte versuche es erneut.');
      }
    } finally {
      setQrDownloadLoading(false);
    }
  }, [item, generateFallbackQr]);

  const handleOpenAttachment = useCallback((url: string) => {
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleDownloadAttachment = useCallback(
    async (attachment: AttachmentView) => {
      setDownloadingAttachmentId(attachment.key);
      setAttachmentError(null);
      try {
        const response = await fetch(attachment.downloadUrl, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Download fehlgeschlagen');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (downloadError) {
        console.error('Failed to download attachment:', downloadError);
        setAttachmentError('Anhang konnte nicht heruntergeladen werden. Bitte überprüfe deine Verbindung und versuche es erneut.');
      } finally {
        setDownloadingAttachmentId(null);
      }
    },
    [],
  );

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) {
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        // Fallback for non-secure contexts or older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.warn('Clipboard API fallback failed:', err);
        }
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopySuccess(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (copyError) {
      setQrError('Link konnte nicht in die Zwischenablage kopiert werden.');
    }
  }, [shareLink]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !item) {
      return;
    }

    // Store the previously focused element only once
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = getFocusableElements();
    const focusTimer = window.setTimeout(() => {
      focusables[0]?.focus({ preventScroll: true });
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'ArrowRight') {
        if (canNavigateNext && onNavigateNext) {
          event.preventDefault();
          onNavigateNext();
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        if (canNavigatePrevious && onNavigatePrevious) {
          event.preventDefault();
          onNavigatePrevious();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;
      const activeHtmlElement = activeElement instanceof HTMLElement ? activeElement : null;

      if (event.shiftKey) {
        if (activeHtmlElement === first || !activeHtmlElement || !dialog.contains(activeHtmlElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      dialog.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus({ preventScroll: true });
      }
    };
  }, [
    canNavigateNext,
    canNavigatePrevious,
    getFocusableElements,
    item,
    onClose,
    onNavigateNext,
    onNavigatePrevious,
  ]);

  useEffect(() => {
    if (!navigationDirection) {
      navigationLockRef.current = false;
      touchNavigatedRef.current = false;
    }
  }, [navigationDirection]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !showNavigation) {
      return;
    }

    const threshold = 12;

    const handleWheel = (event: WheelEvent) => {
      if (navigationLockRef.current || navigationDirection || loading) {
        return;
      }

      const atTop = scrollContainer.scrollTop <= threshold;
      const atBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= threshold;

      if (event.deltaY > 0 && atBottom && canNavigateNext && onNavigateNext) {
        navigationLockRef.current = true;
        event.preventDefault();
        onNavigateNext();
        return;
      }

      if (event.deltaY < 0 && atTop && canNavigatePrevious && onNavigatePrevious) {
        navigationLockRef.current = true;
        event.preventDefault();
        onNavigatePrevious();
      }
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, [
    canNavigateNext,
    canNavigatePrevious,
    loading,
    navigationDirection,
    onNavigateNext,
    onNavigatePrevious,
    showNavigation,
  ]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !showNavigation) {
      return;
    }

    const positionalThreshold = 16;
    const swipeThreshold = 80;

    const handleTouchStart = (event: TouchEvent) => {
      if (loading) {
        return;
      }
      const touch = event.touches[0];
      touchStartYRef.current = touch?.clientY ?? null;
      touchNavigatedRef.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        navigationLockRef.current ||
        navigationDirection ||
        loading ||
        touchNavigatedRef.current ||
        touchStartYRef.current === null
      ) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const deltaY = touchStartYRef.current - touch.clientY;
      const atTop = scrollContainer.scrollTop <= positionalThreshold;
      const atBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= positionalThreshold;

      if (deltaY > swipeThreshold && atBottom && canNavigateNext && onNavigateNext) {
        navigationLockRef.current = true;
        touchNavigatedRef.current = true;
        event.preventDefault();
        onNavigateNext();
        return;
      }

      if (deltaY < -swipeThreshold && atTop && canNavigatePrevious && onNavigatePrevious) {
        navigationLockRef.current = true;
        touchNavigatedRef.current = true;
        event.preventDefault();
        onNavigatePrevious();
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
      touchNavigatedRef.current = false;
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    scrollContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [
    canNavigateNext,
    canNavigatePrevious,
    loading,
    navigationDirection,
    onNavigateNext,
    onNavigatePrevious,
    showNavigation,
  ]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div className="relative flex h-full">
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="flex min-h-full items-start justify-center px-3 py-6 sm:px-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="item-detail-heading"
              className="relative z-10 w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
              ref={dialogRef}
            >
              {/* Header */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="item-detail-heading" className="text-2xl font-semibold text-slate-900">
                    {loading ? 'Lade Details...' : item?.name || 'Gegenstand Details'}
                  </h3>
                  <p className="text-sm text-slate-600">Vollständige Ansicht des Inventargegenstands</p>
                  {!loading && item?.wodis_inventory_number && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      <span>Wodis Inventarnummer</span>
                      <span className="font-mono text-indigo-800">{item.wodis_inventory_number}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:gap-3">
                  {showNavigation && (
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {positionInfo && (
                        <span className="text-xs font-medium text-slate-500 sm:text-sm">
                          {positionInfo.current} von {positionInfo.total}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onNavigatePrevious?.()}
                          disabled={previousDisabled}
                          loading={isNavigatingPrevious}
                          aria-label="Vorheriger Gegenstand"
                        >
                          ← Zurück
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onNavigateNext?.()}
                          disabled={nextDisabled}
                          loading={isNavigatingNext}
                          aria-label="Nächster Gegenstand"
                        >
                          Weiter →
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Schließen">
                    ✕
                  </Button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
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
                            <img
                              src={qrPreview.url}
                              alt={`QR-Code für ${item.name ?? 'Inventargegenstand'}`}
                              className="h-full w-full object-contain"
                            />
                          )}
                          {!qrLoading && !qrPreview?.url && !qrError && (
                            <div className="text-center text-sm text-slate-500">QR-Code wird vorbereitet …</div>
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
                        {!loading && item.wodis_inventory_number && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-800">
                            <p className="font-semibold text-indigo-900">Wodis Inventarnummer</p>
                            <p className="mt-1 font-mono text-xs sm:text-sm">{item.wodis_inventory_number}</p>
                            <p className="mt-1 text-xs text-indigo-700">Nutze diese Nummer für die Suche oder zum Abgleich mit Wodis.</p>
                          </div>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleDownloadQr}
                            loading={qrDownloadLoading}
                            disabled={!item || (!qrPreview?.url && !qrLoading)}
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
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-500" title={shareLink || 'Kein Link verfügbar'}>
                            {shareLink || '—'}
                          </p>
                          <div role="status" aria-live="polite">
                            {copySuccess && <p className="mt-2 text-xs text-emerald-600">Link in Zwischenablage kopiert.</p>}
                            {qrError && !qrLoading && !qrPreview?.url && (
                              <p className="mt-2 text-xs text-red-500">{qrError}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Images Section */}
                  {attachments.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                      <h4 className="mb-4 text-lg font-semibold text-slate-900">Anhänge</h4>
                      {attachmentError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                          {attachmentError}
                        </div>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {attachments.map((attachment) => (
                          <div key={attachment.key} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            {attachment.type === 'image' ? (
                              <figure className="relative">
                                <img
                                  src={attachment.previewUrl}
                                  alt={`${item.name ?? 'Inventargegenstand'} – ${attachment.name}`}
                                  className="h-56 w-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) {
                                      fallback.style.display = 'flex';
                                    }
                                  }}
                                />
                                <div className="hidden h-56 w-full flex-col items-center justify-center bg-slate-100 text-slate-400 fallback-image">
                                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="mt-2 text-sm">Bild konnte nicht geladen werden</span>
                                </div>
                                <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/80 to-transparent px-4 pb-4 pt-6 text-xs text-white">
                                  <span className="truncate pr-2 font-semibold" title={attachment.name}>
                                    {attachment.name}
                                  </span>
                                  <div className="flex gap-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={() => handleOpenAttachment(attachment.previewUrl)}>
                                      Öffnen
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="sm"
                                      loading={downloadingAttachmentId === attachment.key}
                                      onClick={() => handleDownloadAttachment(attachment)}
                                    >
                                      Download
                                    </Button>
                                  </div>
                                </figcaption>
                              </figure>
                            ) : (
                              <div className="flex h-full flex-col justify-between p-5">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                    {attachment.type === 'pdf' ? '📄' : '📁'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
                                      {attachment.name}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                      {attachment.extension?.toUpperCase() || 'Datei'}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                  <Button type="button" variant="secondary" size="sm" onClick={() => handleOpenAttachment(attachment.previewUrl)}>
                                    Öffnen
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    loading={downloadingAttachmentId === attachment.key}
                                    onClick={() => handleDownloadAttachment(attachment)}
                                  >
                                    Download
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-slate-500">Keine Dateien verfügbar</p>
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
                        {item.wodis_inventory_number && (
                          <div>
                            <dt className="text-sm font-medium text-slate-500">Wodis Inventarnummer</dt>
                            <dd className="mt-1 text-sm font-mono text-slate-900">{item.wodis_inventory_number}</dd>
                          </div>
                        )}
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
                              {locationMap[item.location || 0] ?? 'Kein Standort'}
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
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
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
                <div className="mt-8 space-y-4">
                  {deleteError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                      {deleteError}
                    </div>
                  )}
                  {confirmingDelete && canDelete ? (
                    <div
                      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      role="alertdialog"
                      aria-modal="false"
                      aria-labelledby={deleteConfirmTitleId}
                      aria-describedby={deleteConfirmDescriptionId}
                      ref={confirmDeleteRef}
                      tabIndex={-1}
                    >
                      <div>
                        <p id={deleteConfirmTitleId} className="text-sm font-semibold text-red-700">
                          Gegenstand wirklich löschen?
                        </p>
                        <p id={deleteConfirmDescriptionId} className="mt-1 text-sm text-red-600">
                          Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten und Dateien des Gegenstands werden entfernt.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmingDelete(false)}
                          disabled={deleteLoading}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => onDelete?.()}
                          loading={deleteLoading}
                          disabled={deleteLoading}
                        >
                          Jetzt löschen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {canDelete && (
                        <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                          Gegenstand löschen
                        </Button>
                      )}
                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={onClose}>
                          Schließen
                        </Button>
                        <Button type="button" variant="primary" onClick={onEdit}>
                          Bearbeiten
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailView;
