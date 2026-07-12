import React, { useRef } from "react";
import Button from "./common/Button";
import ItemChangeHistory from "./ItemChangeHistory";
import ItemScanActions from "./ItemScanActions";
import type { ItemViewProps } from "./itemViewTypes";
import { useItemPresentation } from "./useItemPresentation";
const ItemScanView: React.FC<ItemViewProps> = ({
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canDelete = typeof onDelete === "function";
  const showNavigation = Boolean(onNavigatePrevious || onNavigateNext);
  const isNavigatingNext = navigationDirection === "next";
  const isNavigatingPrevious = navigationDirection === "previous";
  const previousDisabled =
    !onNavigatePrevious || !canNavigatePrevious || loading || isNavigatingPrevious;
  const nextDisabled =
    !onNavigateNext || !canNavigateNext || loading || isNavigatingNext;
  const {
    attachmentError, attachments, changelog, changelogError,
    changelogLoading, confirmingDelete, confirmDeleteRef, copySuccess,
    deleteConfirmDescriptionId, deleteConfirmTitleId,
    downloadingAttachmentId, formatCurrency, formatDate,
    handleCopyShareLink, handleDownloadAttachment, handleDownloadQr,
    handleOpenAttachment, handleRefreshQr, qrDownloadLoading,
    qrError, qrLoading, qrPreview, setConfirmingDelete,
    shareLink,
  } = useItemPresentation(item);
  return (
    <div className="w-full" ref={scrollContainerRef}>
      <div className="w-full bg-white p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3
              id="item-detail-heading"
              className="text-2xl font-semibold text-slate-900"
            >
              {loading ? "Lade Details..." : item?.name || "Gegenstand Details"}
            </h3>
            <p className="text-sm text-slate-600">
              Vollständige Ansicht des Inventargegenstands
            </p>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Schließen"
            >
              ✕
            </Button>
          </div>
        </div>
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div
                className={[
                  "mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200",
                  "border-t-brand-600",
                ].join(" ")}
              />
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
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="flex w-full justify-center lg:w-auto">
                  <div
                    className={[
                      "flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border",
                      "border-dashed border-slate-200 bg-slate-50 p-4",
                    ].join(" ")}
                  >
                    {qrLoading && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-500">
                        <span
                          className={[
                            "inline-flex h-8 w-8 animate-spin rounded-full border-4 border-slate-200",
                            "border-t-brand-600",
                          ].join(" ")}
                        />
                        <span>QR-Code wird erstellt …</span>
                      </div>
                    )}
                    {!qrLoading && qrPreview?.url && (
                      <img
                        src={qrPreview.url}
                        alt={`QR-Code für ${item.name ?? "Inventargegenstand"}`}
                        className="h-full w-full object-contain"
                      />
                    )}
                    {!qrLoading && !qrPreview?.url && !qrError && (
                      <div className="text-center text-sm text-slate-500">
                        QR-Code wird vorbereitet …
                      </div>
                    )}
                    {!qrLoading && qrError && !qrPreview?.url && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-red-500">
                        <span>QR-Code konnte nicht geladen werden.</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleRefreshQr}
                        >
                          Erneut versuchen
                        </Button>
                      </div>
                    )}
                    {!qrLoading && qrError && qrPreview?.url && (
                      <div className="flex flex-col items-center gap-3 text-center text-sm text-amber-500">
                        <span>{qrError}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleRefreshQr}
                        >
                          Erneut versuchen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      QR-Code für schnellen Zugriff
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Scanne den Code, um diesen Gegenstand sofort zu öffnen.
                      Teile den Link mit deinem Team oder drucke den Code für
                      dein Inventar aus.
                    </p>
                  </div>
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
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                      {shareLink || "—"}
                    </p>
                    <div role="status" aria-live="polite">
                      {copySuccess && (
                        <p className="mt-2 text-xs text-emerald-600">
                          Link in Zwischenablage kopiert.
                        </p>
                      )}
                      {qrError && !qrLoading && !qrPreview?.url && (
                        <p className="mt-2 text-xs text-red-500">{qrError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {attachments.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">
                  Anhänge
                </h4>
                {attachmentError && (
                  <div
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                    role="alert"
                  >
                    {attachmentError}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.key}
                      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      {attachment.type === "image" ? (
                        <figure className="relative">
                          <img
                            src={attachment.previewUrl}
                            alt={`${item.name ?? "Inventargegenstand"} – ${attachment.name}`}
                            className="h-56 w-full object-cover"
                          />
                          <figcaption
                            className={[
                              "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2",
                              "bg-gradient-to-t from-slate-900/80 to-transparent px-4 pb-4 pt-6 text-xs",
                              "text-white",
                            ].join(" ")}
                          >
                            <span
                              className="truncate pr-2 font-semibold"
                              title={attachment.name}
                            >
                              {attachment.name}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleOpenAttachment(attachment.previewUrl)
                                }
                              >
                                Öffnen
                              </Button>
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                loading={
                                  downloadingAttachmentId === attachment.key
                                }
                                onClick={() =>
                                  handleDownloadAttachment(attachment)
                                }
                              >
                                Download
                              </Button>
                            </div>
                          </figcaption>
                        </figure>
                      ) : (
                        <div className="flex h-full flex-col justify-between p-5">
                          <div className="flex items-start gap-3">
                            <div
                              className={[
                                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100",
                                "text-slate-600",
                              ].join(" ")}
                            >
                              {attachment.type === "pdf" ? "📄" : "📁"}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-semibold text-slate-900"
                                title={attachment.name}
                              >
                                {attachment.name}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                {attachment.extension?.toUpperCase() || "Datei"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleOpenAttachment(attachment.previewUrl)
                              }
                            >
                              Öffnen
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              loading={
                                downloadingAttachmentId === attachment.key
                              }
                              onClick={() =>
                                handleDownloadAttachment(attachment)
                              }
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
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">
                  Grundinformationen
                </h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Name</dt>
                    <dd className="mt-1 text-sm text-slate-900">{item.name}</dd>
                  </div>
                  {item.description && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">
                        Beschreibung
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {item.description}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      Menge
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {item.quantity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Wert</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCurrency(item.value)}
                    </dd>
                  </div>
                  {item.purchase_date && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">
                        Kaufdatum
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {formatDate(item.purchase_date)}
                      </dd>
                    </div>
                  )}
                  {item.asset_tag && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">
                        Asset-Tag
                      </dt>
                      <dd className="mt-1 text-sm font-mono text-slate-900">
                        {item.asset_tag}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-slate-900">
                  Zuordnung
                </h4>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">
                      Standort
                    </dt>
                    <dd className="mt-1">
                      <span
                        className={[
                          "inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium",
                          "text-blue-800",
                        ].join(" ")}
                      >
                        {locationMap[item.location ?? 0] ?? "Kein Standort"}
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
                              className={[
                                "inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm font-medium",
                                "text-brand-800",
                              ].join(" ")}
                            >
                              {tagMap[tagId] ?? `Tag ${tagId}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">
                          Keine Tags zugewiesen
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h4 className="mb-4 text-lg font-semibold text-slate-900">
                Änderungshistorie
              </h4>
              <ItemChangeHistory
                changelog={changelog}
                loading={changelogLoading}
                error={changelogError}
              />
            </div>
          </div>
        )}
        {!loading && !error && item && (
          <ItemScanActions
            canDelete={canDelete}
            confirmingDelete={confirmingDelete}
            confirmDeleteRef={confirmDeleteRef}
            deleteConfirmTitleId={deleteConfirmTitleId}
            deleteConfirmDescriptionId={deleteConfirmDescriptionId}
            deleteLoading={deleteLoading}
            deleteError={deleteError}
            onClose={onClose}
            onEdit={onEdit}
            onDelete={onDelete}
            setConfirmingDelete={setConfirmingDelete}
          />
        )}
      </div>
    </div>
  );
};
export default ItemScanView;
