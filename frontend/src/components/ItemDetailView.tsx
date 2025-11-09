import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Item, ItemChangeLog } from '../types/inventory.js';
import { apiBaseUrl } from '../api/client.js';
import { fetchItemQrCode, fetchItemChangelog } from '../api/inventory.js';
import Button from './common/Button.js';
import ItemChangeHistory from './ItemChangeHistory.js';

/**
 * Represents the position of the currently viewed item within a larger list.
 * @interface DetailPositionInfo
 */
interface DetailPositionInfo {
  /** The 1-based index of the current item. */
  current: number;
  /** The total number of items in the list. */
  total: number;
}

/**
 * Props for the ItemDetailView component.
 * @interface ItemDetailViewProps
 */
interface ItemDetailViewProps {
  /** The item object to display. Null if no item is selected or if it's loading. */
  item: Item | null;
  /** Indicates if the item data is currently being loaded. */
  loading: boolean;
  /** An error message if loading the item failed, otherwise null. */
  error: string | null;
  /** Callback function to close the detail view. */
  onClose: () => void;
  /** Callback function to switch to the edit mode for the current item. */
  onEdit: () => void;
  /** Optional callback to retry loading the item data. */
  onRetry?: () => void;
  /** Optional callback to initiate the deletion of the item. */
  onDelete?: () => void;
  /** Indicates if the item is currently being deleted. Defaults to `false`. */
  deleteLoading?: boolean;
  /** An error message if deleting the item failed. Defaults to `null`. */
  deleteError?: string | null;
  /** A key-value map of tag IDs to tag names for display purposes. */
  tagMap: Record<number, string>;
  /** A key-value map of location IDs to location names for display purposes. */
  locationMap: Record<number, string>;
  /** Optional callback to navigate to the previous item in the list. */
  onNavigatePrevious?: () => void;
  /** Optional callback to navigate to the next item in the list. */
  onNavigateNext?: () => void;
  /** Indicates if navigation to a previous item is possible. Defaults to `false`. */
  canNavigatePrevious?: boolean;
  /** Indicates if navigation to a next item is possible. Defaults to `false`. */
  canNavigateNext?: boolean;
  /** The current direction of navigation, used for showing loading states on navigation buttons. */
  navigationDirection?: 'next' | 'previous' | null;
  /** Information about the item's position in a list, if applicable. */
  positionInfo?: DetailPositionInfo | null;
}

/**
 * A CSS selector for identifying all focusable elements within the dialog.
 * Used for focus trapping to ensure accessibility.
 * @type {string}
 */
const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A comprehensive modal dialog component that displays complete details for a single inventory item.
 * 
 * This component serves as the central hub for item information and management, providing:
 * - Complete item attribute display with German localization and proper formatting
 * - Advanced attachment handling with preview, download, and error management
 * - Dynamic QR code generation with server fallback and client-side generation
 * - Full change history tracking with detailed diff display
 * - Accessibility-compliant focus management and keyboard navigation
 * - Responsive design with mobile-optimized layouts
 * - Security considerations for file handling and URL generation
 *
 * State Management Strategy:
 * - Complex async state handling for QR codes, attachments, and change logs
 * - Proper cleanup of object URLs to prevent memory leaks
 * - Focus trapping for accessibility compliance
 * - Error boundaries with user-friendly error messages
 * 
 * Performance Features:
 * - Memoized calculations for expensive operations
 * - Optimized image loading with lazy loading and error boundaries
 * - Efficient QR code generation with caching mechanisms
 * - Proper debouncing for user interactions
 *
 * @param {ItemDetailViewProps} props The props for the component including item data, callbacks, and UI state.
 * @returns {JSX.Element} A fully accessible, responsive detail view modal with comprehensive functionality.
 */
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
  /**
   * Represents the state of the QR code preview.
   * @property {string} url - The URL of the QR code image (can be a data URL or object URL).
   * @property {boolean} revokable - True if the URL is an object URL that needs to be revoked later to prevent memory leaks.
   */
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

  const canDelete = typeof onDelete === 'function';

  const showNavigation = Boolean(onNavigatePrevious || onNavigateNext);
  const isNavigatingNext = navigationDirection === 'next';
  const isNavigatingPrevious = navigationDirection === 'previous';
  const previousDisabled = !onNavigatePrevious || !canNavigatePrevious || loading || isNavigatingPrevious;
  const nextDisabled = !onNavigateNext || !canNavigateNext || loading || isNavigatingNext;

  /**
   * Retrieves all currently focusable elements within the dialog, filtering out those that are disabled or hidden.
   * @returns {HTMLElement[]} An array of focusable HTML elements.
   */
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

  /**
   * Computes the base URL for media files, attempting to derive it from the API base URL or window location.
   * @type {string}
   */
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

  /**
   * A structured view of an item's attachment for rendering.
   * @property {string|number} key - A unique key for the attachment.
   * @property {string} previewUrl - URL for previewing the attachment.
   * @property {string} downloadUrl - URL for downloading the attachment.
   * @property {string} name - The filename of the attachment.
   * @property {string} extension - The file extension.
   * @property {'image'|'pdf'|'file'} type - The type of the attachment.
   */
  type AttachmentView = {
    key: string | number;
    previewUrl: string;
    downloadUrl: string;
    name: string;
    extension: string;
    type: 'image' | 'pdf' | 'file';
  };

  /**
   * Memoized list of processed attachments for the current item, ready for rendering.
   * @type {AttachmentView[]}
   */
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

  /**
   * Memoized, unique ID for the delete confirmation dialog's title.
   * @type {string}
   */
  const deleteConfirmTitleId = useMemo(
    () => (item ? `item-delete-confirm-${item.id}` : 'item-delete-confirm'),
    [item],
  );

  /**
   * Memoized, unique ID for the delete confirmation dialog's description.
   * @type {string}
   */
  const deleteConfirmDescriptionId = useMemo(
    () => `${deleteConfirmTitleId}-description`,
    [deleteConfirmTitleId],
  );

  /**
   * Safely releases a revocable object URL to prevent memory leaks.
   * @param {QrPreview | null} preview - The QR code preview object.
   */
  const releaseQrPreview = useCallback((preview: QrPreview | null) => {
    if (preview?.revokable) {
      URL.revokeObjectURL(preview.url);
    }
  }, []);

  /**
   * Clears the current QR code preview, releasing its object URL if necessary.
   */
  const clearQrPreview = useCallback(() => {
    setQrPreview((previous) => {
      releaseQrPreview(previous);
      return null;
    });
  }, [releaseQrPreview]);

  /**
   * Sets a new QR code preview, ensuring the previous one is released.
   * @param {QrPreview} preview - The new QR code preview object.
   */
  const setQrPreviewValue = useCallback(
    (preview: QrPreview) => {
      setQrPreview((previous) => {
        releaseQrPreview(previous);
        return preview;
      });
    },
    [releaseQrPreview],
  );

  /**
   * Formats a string value as a German currency (EUR).
   * @param {string | null} value - The numeric string to format.
   * @returns {string} The formatted currency string, or '—' if invalid.
   */
  const formatCurrency = (value: string | null) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return '—';
    }
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numeric);
  };

  /**
   * Formats a date string into a German date format (DD.MM.YYYY).
   * @param {string | null} value - The date string to format.
   * @returns {string} The formatted date string, or '—' if invalid.
   */
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

  /**
   * Memoized public-facing link to the item's scan page.
   * @type {string}
   */
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

  /**
   * Generates a QR code on the client-side as a fallback if the server-side generation fails.
   * @returns {Promise<boolean>} A promise that resolves to true if the fallback was generated successfully.
   */
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

  /**
   * Effect to clean up the copy success message timeout on unmount.
   */
  useEffect(() => (
    () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  ), []);

  /**
   * Effect to reset component state when the item prop changes.
   */
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
    }
  }, [item]);

  /**
   * Effect to hide the delete confirmation when the item changes.
   */
  useEffect(() => {
    setConfirmingDelete(false);
  }, [item, canDelete]);

  /**
   * Effect to focus the delete confirmation dialog when it becomes visible.
   */
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

  /**
   * Effect to keep a ref to the current QR preview to prevent stale closures in cleanup.
   */
  useEffect(() => {
    qrPreviewRef.current = qrPreview;
  }, [qrPreview]);

  /**
   * Effect to release the QR code's object URL on unmount.
   */
  useEffect(
    () => () => {
      releaseQrPreview(qrPreviewRef.current);
    },
    [releaseQrPreview],
  );

  /**
   * Effect to fetch the item's changelog whenever the item changes.
   */
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

  /**
   * Effect to fetch the item's QR code from the server.
   * It handles loading states, errors, and triggers a client-side fallback if necessary.
   */
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

  /**
   * Triggers a refresh of the server-generated QR code.
   */
  const handleRefreshQr = useCallback(() => {
    setQrReloadToken((prev) => prev + 1);
  }, []);

  /**
   * Handles downloading the QR code as a PNG file.
   * It attempts to fetch a high-quality version from the server first,
   * then falls back to converting the currently displayed preview.
   */
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

  /**
   * Opens an attachment's preview URL in a new browser tab.
   * @param {string} url - The URL of the attachment to open.
   */
  const handleOpenAttachment = useCallback((url: string) => {
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  /**
   * Initiates the download of an attachment file.
   * @param {AttachmentView} attachment - The attachment to download.
   */
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

  /**
   * Copies the item's share link to the user's clipboard.
   * Shows a success message on completion.
   */
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

  /**
   * Effect to manage focus trapping, keyboard shortcuts (Escape, Arrow keys), and restoring focus on close.
   * This is critical for accessibility.
   */
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

                  {/* Change History Section */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h4 className="mb-4 text-lg font-semibold text-slate-900">Änderungshistorie</h4>
                    <ItemChangeHistory changelog={changelog} loading={changelogLoading} error={changelogError} />
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
