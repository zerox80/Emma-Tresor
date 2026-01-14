import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import type { Item, ItemChangeLog } from '../types/inventory';
import { apiBaseUrl } from '../api/client';
import { fetchItemQrCode, fetchItemChangelog } from '../api/inventory';
import Button from './common/Button';
import ItemChangeHistory from './ItemChangeHistory';

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
  const [changelog, setChangelog] = useState<ItemChangeLog[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLDivElement | null>(null);

  type TabType = 'overview' | 'attachments' | 'history';
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const canDelete = typeof onDelete === 'function';

  const showNavigation = Boolean(onNavigatePrevious || onNavigateNext);
  const isNavigatingNext = navigationDirection === 'next';
  const isNavigatingPrevious = navigationDirection === 'previous';
  const previousDisabled = !onNavigatePrevious || !canNavigatePrevious || loading || isNavigatingPrevious;
  const nextDisabled = !onNavigateNext || !canNavigateNext || loading || isNavigatingNext;

  const handleTabChange = (tab: TabType) => setActiveTab(tab);

  const handleNextTab = () => {
    if (activeTab === 'overview') setActiveTab('attachments');
    else if (activeTab === 'attachments') setActiveTab('history');
  };

  const handlePrevTab = () => {
    if (activeTab === 'history') setActiveTab('attachments');
    else if (activeTab === 'attachments') setActiveTab('overview');
  };

  const getFocusableElements = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return [] as HTMLElement[];
    }
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => {

        if (element.hasAttribute('disabled')) {
          return false;
        }

        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.pointerEvents === 'none') {
          return false;
        }

        if (element.getAttribute('aria-hidden') === 'true') {
          return false;
        }

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

    return item.images.map((attachment: any, index: number) => {
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
      setChangelog([]);
      setChangelogError(null);
    } else {
      // Reset tab to overview when item changes (navigation)
      setActiveTab('overview');
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

    if (!item) {
      setChangelog([]);
      setChangelogLoading(false);
      setChangelogError(null);
      return;
    }

    const loadChangelog = async () => {
      setChangelogLoading(true);
      setChangelogError(null);
      try {
        const logs = await fetchItemChangelog(item.id);
        if (active) {
          setChangelog(logs);
        }
      } catch (err) {
        if (active) {
          setChangelogError('Änderungshistorie konnte nicht geladen werden.');
        }
      } finally {
        if (active) {
          setChangelogLoading(false);
        }
      }
    };

    void loadChangelog();

    return () => {
      active = false;
    };
  }, [item]);

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
    setQrReloadToken((prev: number) => prev + 1);
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
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose} />
      <div className="relative flex h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-detail-heading"
          className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10"
          ref={dialogRef}
        >
          {/* Header & Tabs Section */}
          <div className="flex-none border-b border-slate-200 bg-white">
            <div className="flex items-start justify-between p-6 sm:px-8">
              <div>
                <h3 id="item-detail-heading" className="text-2xl font-semibold text-slate-900">
                  {loading ? 'Lade Details...' : item?.name || 'Gegenstand Details'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">Vollständige Ansicht des Inventargegenstands</p>
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
                        ← <span className="hidden sm:inline">Vorheriger</span>
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
                        <span className="hidden sm:inline">Nächster</span> →
                      </Button>
                    </div>
                  </div>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Schließen">
                  ✕
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 sm:px-8">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`${activeTab === 'overview'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={activeTab === 'overview' ? 'page' : undefined}
                >
                  Übersicht
                </button>
                <button
                  onClick={() => handleTabChange('attachments')}
                  className={`${activeTab === 'attachments'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={activeTab === 'attachments' ? 'page' : undefined}
                >
                  Anhänge {attachments.length > 0 && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">{attachments.length}</span>}
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  className={`${activeTab === 'history'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={activeTab === 'history' ? 'page' : undefined}
                >
                  Änderungshistorie
                </button>
              </nav>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 sm:p-8" ref={scrollContainerRef}>
            {loading && (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
                  <p className="text-slate-600">Lade Gegenstand-Details...</p>
                </div>
              </div>
            )}

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

            {!loading && !error && item && (
              <div className="space-y-8">
                {/* Overview Tab Content */}
                {activeTab === 'overview' && (
                  <>
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                        {/* QR Code Section */}
                        <div className="flex flex-none flex-col items-center gap-4 sm:w-64">
                          <div className="flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                            {qrLoading && (
                              <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-500">
                                <span className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
                                <span>QR-Code wird erstellt...</span>
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
                              <div className="text-center text-sm text-slate-500">QR-Code wird vorbereitet...</div>
                            )}
                            {!qrLoading && qrError && !qrPreview?.url && (
                              <div className="flex flex-col items-center gap-3 text-center text-sm text-red-500">
                                <span>Fehler beim Laden</span>
                                <Button type="button" variant="secondary" size="xs" onClick={handleRefreshQr}>
                                  Neu laden
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="flex w-full flex-col gap-2">
                            <Button
                              type="button"
                              variant="secondary" // Changed to secondary to de-emphasize
                              size="sm"
                              className="w-full"
                              onClick={handleDownloadQr}
                              disabled={!item || (!qrPreview?.url && !qrLoading)}
                            >
                              QR-Code speichern
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full text-slate-500 hover:text-slate-700"
                              onClick={handleCopyShareLink}
                              disabled={!shareLink}
                            >
                              Link kopieren
                            </Button>
                            {copySuccess && <p className="text-center text-xs text-emerald-600">Kopiert!</p>}
                          </div>
                        </div>

                        {/* Info Section */}
                        <div className="flex-1 space-y-6">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">Grundinformationen</h4>
                            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Name</dt>
                                <dd className="mt-1 text-sm font-medium text-slate-900">{item.name}</dd>
                              </div>
                              {item.description && (
                                <div className="sm:col-span-2">
                                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Beschreibung</dt>
                                  <dd className="mt-1 text-sm text-slate-700 max-w-prose">{item.description}</dd>
                                </div>
                              )}
                              <div>
                                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Menge</dt>
                                <dd className="mt-1 text-sm text-slate-900">{item.quantity} Stück</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Wert</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</dd>
                              </div>
                              {item.purchase_date && (
                                <div>
                                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kaufdatum</dt>
                                  <dd className="mt-1 text-sm text-slate-900">{formatDate(item.purchase_date)}</dd>
                                </div>
                              )}
                              {item.asset_tag && (
                                <div>
                                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Asset-Tag</dt>
                                  <dd className="mt-1 text-sm font-mono text-slate-700 bg-slate-100 inline-block px-1 rounded">{item.asset_tag}</dd>
                                </div>
                              )}
                            </dl>
                          </div>

                          <div className="border-t border-slate-100 pt-6">
                            <h4 className="text-lg font-semibold text-slate-900">Zuordnung</h4>
                            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                              <div>
                                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Standort</dt>
                                <dd className="mt-1">
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    {locationMap[item.location || 0] ?? 'Kein Standort'}
                                  </span>
                                </dd>
                              </div>
                              {(item.employee_name || item.room_number) && (
                                <>
                                  {item.employee_name && (
                                    <div>
                                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mitarbeiter</dt>
                                      <dd className="mt-1 text-sm text-slate-900">{item.employee_name}</dd>
                                    </div>
                                  )}
                                  {item.room_number && (
                                    <div>
                                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Raum Nr</dt>
                                      <dd className="mt-1 text-sm text-slate-900">{item.room_number}</dd>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="sm:col-span-2">
                                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</dt>
                                <dd className="mt-2">
                                  {item.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {item.tags.map((tagId: number) => (
                                        <span
                                          key={tagId}
                                          className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10"
                                        >
                                          {tagMap[tagId] ?? `Tag ${tagId}`}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm italic text-slate-400">Keine Tags</span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {/* Attachments Tab Content */}
                {activeTab === 'attachments' && (
                  <div className="min-h-[300px]">
                    {attachmentError && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                        {attachmentError}
                      </div>
                    )}
                    {attachments.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {attachments.map((attachment: AttachmentView) => (
                          <div key={attachment.key} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                            {attachment.type === 'image' ? (
                              <figure className="relative group">
                                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                                  <img
                                    src={attachment.previewUrl}
                                    alt={attachment.name}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.parentElement!.querySelector('.fallback-image')!.classList.remove('hidden');
                                      target.parentElement!.querySelector('.fallback-image')!.classList.add('flex');
                                    }}
                                  />
                                  <div className="fallback-image hidden h-full w-full flex-col items-center justify-center text-slate-400">
                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  <p className="truncate text-xs font-semibold">{attachment.name}</p>
                                  <div className="mt-2 flex gap-2">
                                    <Button type="button" variant="secondary" size="xs" onClick={() => handleOpenAttachment(attachment.previewUrl)}>
                                      Öffnen
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="xs"
                                      loading={downloadingAttachmentId === attachment.key}
                                      onClick={() => handleDownloadAttachment(attachment)}
                                    >
                                      Download
                                    </Button>
                                  </div>
                                </figcaption>
                              </figure>
                            ) : (
                              <div className="flex h-full flex-col justify-between p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                                    {attachment.type === 'pdf' ? '📄' : '📁'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
                                      {attachment.name}
                                    </p>
                                    <p className="text-xs text-slate-500 uppercase">{attachment.extension}</p>
                                  </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                  <Button type="button" variant="secondary" size="xs" className="flex-1" onClick={() => handleOpenAttachment(attachment.previewUrl)}>
                                    Öffnen
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="xs"
                                    className="flex-1"
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
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
                        <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <p className="text-sm">Keine Anhänge vorhanden</p>
                      </div>
                    )}
                  </div>
                )}

                {/* History Tab Content */}
                {activeTab === 'history' && (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[300px]">
                    <ItemChangeHistory changelog={changelog} loading={changelogLoading} error={changelogError} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer / Actions */}
          <div className="flex-none border-t border-slate-200 bg-slate-50 p-4 sm:px-8 sm:py-5">
            {!loading && !error && item && (
              <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Delete Section */}
                {confirmingDelete && canDelete ? (
                  <div className="flex flex-1 items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200 animate-in fade-in zoom-in-95 duration-200">
                    <span className="font-medium mr-4">Wirklich löschen?</span>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleteLoading} className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300">
                        Abbrechen
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => onDelete?.()} loading={deleteLoading}>
                        Ja, löschen
                      </Button>
                    </div>
                  </div>
                ) : (
                  canDelete && (
                    <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 px-2 sm:px-4" onClick={() => setConfirmingDelete(true)}>
                      Gegenstand löschen
                    </Button>
                  )
                )}

                {/* Tab Navigation & Main Actions */}
                <div className={`flex gap-3 ${confirmingDelete ? 'opacity-50 pointer-events-none' : ''}`}>
                  {activeTab !== 'overview' && (
                    <Button type="button" variant="secondary" onClick={handlePrevTab}>
                      Zurück
                    </Button>
                  )}
                  {activeTab !== 'history' && (
                    <Button type="button" variant="primary" onClick={handleNextTab}>
                      Weiter
                    </Button>
                  )}

                  <div className="mx-1 hidden h-10 w-px bg-slate-200 sm:block" />

                  <Button type="button" variant="secondary" onClick={onClose}>
                    Schließen
                  </Button>
                  <Button type="button" variant="primary" onClick={onEdit}>
                    Bearbeiten
                  </Button>
                </div>
              </div>
            )}

            {(loading || error || !item) && (
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Schließen
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ItemDetailView;
