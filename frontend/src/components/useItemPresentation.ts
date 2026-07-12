import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { apiBaseUrl } from "../api/client";
import { fetchItemChangelog, fetchItemQrCode } from "../api/inventory";
import type { Item, ItemChangeLog } from "../types/inventory";

export interface AttachmentView {
  key: string | number;
  previewUrl: string;
  downloadUrl: string;
  name: string;
  extension: string;
  type: "image" | "pdf" | "file";
}

interface QrPreview {
  url: string;
  revokable: boolean;
}

export const formatItemCurrency = (value: string | null) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(numeric);
};

export const formatItemDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const getApiMediaBase = () => {
  try {
    const base = apiBaseUrl.replace(/\/@?api(?:\/)?$/i, "/");
    return `${new URL(base).toString().replace(/\/$/, "")}/`;
  } catch {
    return typeof window === "undefined" ? apiBaseUrl : `${window.location.origin}/`;
  }
};

export const useItemPresentation = (item: Item | null) => {
  const [qrPreview, setQrPreview] = useState<QrPreview | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrReloadToken, setQrReloadToken] = useState(0);
  const [qrDownloadLoading, setQrDownloadLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | number | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<ItemChangeLog[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const qrPreviewRef = useRef<QrPreview | null>(null);
  const confirmDeleteRef = useRef<HTMLDivElement | null>(null);
  const apiMediaBase = useMemo(getApiMediaBase, []);

  const resolveAssetUrl = useCallback(
    (path: string | null | undefined) => {
      if (!path) return "";
      if (/^https?:\/\//.test(path)) return path;
      const normalised = path.startsWith("/") ? path.slice(1) : path;
      try {
        return new URL(normalised, apiMediaBase).toString();
      } catch {
        return path;
      }
    },
    [apiMediaBase],
  );

  const attachments = useMemo<AttachmentView[]>(() => {
    if (!item?.images) return [];
    return item.images.map((attachment, index) => {
      if (typeof attachment === "string") {
        const url = resolveAssetUrl(attachment);
        return {
          key: `img-${index}`,
          previewUrl: url,
          downloadUrl: url,
          name: `Datei-${index + 1}`,
          extension: attachment.split(".").pop()?.toLowerCase() ?? "",
          type: attachment.endsWith(".pdf") ? "pdf" : "image",
        };
      }
      const name = attachment.filename || `Datei-${index + 1}`;
      const extension = name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
      const type =
        extension === "pdf"
          ? "pdf"
          : attachment.content_type?.startsWith("image/")
            ? "image"
            : "file";
      return {
        key: attachment.id ?? `img-${index}`,
        previewUrl: attachment.preview_url || resolveAssetUrl(attachment.image) || resolveAssetUrl(name),
        downloadUrl: attachment.download_url || resolveAssetUrl(attachment.image),
        name,
        extension,
        type,
      };
    });
  }, [item, resolveAssetUrl]);

  const deleteConfirmTitleId = useMemo(
    () => (item ? `item-delete-confirm-${item.id}` : "item-delete-confirm"),
    [item],
  );
  const deleteConfirmDescriptionId = `${deleteConfirmTitleId}-description`;

  const releaseQrPreview = useCallback((preview: QrPreview | null) => {
    if (preview?.revokable) URL.revokeObjectURL(preview.url);
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

  const shareLink = useMemo(() => {
    if (!item?.asset_tag) return "";
    const path = `scan/${encodeURIComponent(item.asset_tag)}`;
    try {
      const base = typeof window === "undefined" ? apiMediaBase : `${window.location.origin}/`;
      return new URL(path, base).toString();
    } catch {
      return path;
    }
  }, [apiMediaBase, item]);

  const generateFallbackQr = useCallback(async () => {
    if (!shareLink) return false;
    try {
      const dataUrl = await QRCode.toDataURL(shareLink, {
        width: 480,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      setQrPreviewValue({ url: dataUrl, revokable: false });
      return true;
    } catch {
      return false;
    }
  }, [setQrPreviewValue, shareLink]);

  useEffect(() => {
    qrPreviewRef.current = qrPreview;
  }, [qrPreview]);

  useEffect(
    () => () => {
      releaseQrPreview(qrPreviewRef.current);
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    },
    [releaseQrPreview],
  );

  useEffect(() => {
    setConfirmingDelete(false);
    if (!item) {
      setCopySuccess(false);
      setAttachmentError(null);
      setChangelog([]);
      setChangelogError(null);
    }
  }, [item]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = window.setTimeout(() => confirmDeleteRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [confirmingDelete]);

  useEffect(() => {
    let active = true;
    if (!item) {
      setChangelog([]);
      setChangelogLoading(false);
      return;
    }
    setChangelogLoading(true);
    setChangelogError(null);
    void fetchItemChangelog(item.id)
      .then((logs) => active && setChangelog(logs))
      .catch(() => active && setChangelogError("Änderungshistorie konnte nicht geladen werden."))
      .finally(() => active && setChangelogLoading(false));
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
        if (active) setQrPreviewValue({ url: URL.createObjectURL(blob), revokable: true });
      } catch {
        if (!active) return;
        const fallbackOk = await generateFallbackQr();
        setQrError(
          fallbackOk
            ? "Server-QR-Code nicht verfügbar. Lokale Version wird angezeigt."
            : "QR-Code konnte nicht geladen werden. Bitte versuche es erneut.",
        );
      } finally {
        if (active) setQrLoading(false);
      }
    };
    void loadQrCode();
    return () => {
      active = false;
    };
  }, [clearQrPreview, generateFallbackQr, item, qrReloadToken, setQrPreviewValue]);

  const handleRefreshQr = useCallback(() => setQrReloadToken((value) => value + 1), []);

  const handleDownloadQr = useCallback(async () => {
    if (!item) return;
    setQrDownloadLoading(true);
    try {
      let blob: Blob;
      try {
        blob = await fetchItemQrCode(item.id, { download: true });
      } catch (downloadError) {
        if (!qrPreviewRef.current && !(await generateFallbackQr())) throw downloadError;
        const sourceUrl = qrPreviewRef.current?.url;
        if (!sourceUrl) throw downloadError;
        blob = await fetch(sourceUrl).then((response) => response.blob());
        setQrError("Server-QR-Code nicht verfügbar. Lokale Version wurde heruntergeladen.");
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `item-${item.id}-qr.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setQrError("QR-Code konnte nicht heruntergeladen werden. Bitte versuche es erneut.");
    } finally {
      setQrDownloadLoading(false);
    }
  }, [generateFallbackQr, item]);

  const handleOpenAttachment = useCallback((url: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleDownloadAttachment = useCallback(async (attachment: AttachmentView) => {
    setDownloadingAttachmentId(attachment.key);
    setAttachmentError(null);
    try {
      const response = await fetch(attachment.downloadUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Download fehlgeschlagen");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      setAttachmentError(
        "Anhang konnte nicht heruntergeladen werden. Bitte überprüfe deine Verbindung und versuche es erneut.",
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setQrError("Link konnte nicht in die Zwischenablage kopiert werden.");
    }
  }, [shareLink]);

  return {
    attachmentError,
    attachments,
    changelog,
    changelogError,
    changelogLoading,
    confirmingDelete,
    confirmDeleteRef,
    copySuccess,
    deleteConfirmDescriptionId,
    deleteConfirmTitleId,
    downloadingAttachmentId,
    formatCurrency: formatItemCurrency,
    formatDate: formatItemDate,
    handleCopyShareLink,
    handleDownloadAttachment,
    handleDownloadQr,
    handleOpenAttachment,
    handleRefreshQr,
    qrDownloadLoading,
    qrError,
    qrLoading,
    qrPreview,
    setConfirmingDelete,
    shareLink,
  };
};
