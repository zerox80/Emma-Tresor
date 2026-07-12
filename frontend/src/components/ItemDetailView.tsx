import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Button from "./common/Button";
import ItemChangeHistory from "./ItemChangeHistory";
import { ItemAttachmentsTab, ItemOverviewTab } from "./ItemDetailTabs";
import type { ItemViewProps } from "./itemViewTypes";
import { useDialogFocusTrap } from "./useDialogFocusTrap";
import { useItemPresentation } from "./useItemPresentation";

const ItemDetailView: React.FC<ItemViewProps> = ({
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

  type TabType = "overview" | "attachments" | "history";
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const canDelete = typeof onDelete === "function";

  const showNavigation = Boolean(onNavigatePrevious || onNavigateNext);
  const isNavigatingNext = navigationDirection === "next";
  const isNavigatingPrevious = navigationDirection === "previous";
  const previousDisabled =
    !onNavigatePrevious ||
    !canNavigatePrevious ||
    loading ||
    isNavigatingPrevious;
  const nextDisabled =
    !onNavigateNext || !canNavigateNext || loading || isNavigatingNext;
  const dialogRef = useDialogFocusTrap({
    active: Boolean(item),
    onClose,
    onNavigatePrevious,
    onNavigateNext,
    canNavigatePrevious,
    canNavigateNext,
  });

  const handleTabChange = (tab: TabType) => setActiveTab(tab);

  const handleNextTab = () => {
    if (activeTab === "overview") setActiveTab("attachments");
    else if (activeTab === "attachments") setActiveTab("history");
  };

  const handlePrevTab = () => {
    if (activeTab === "history") setActiveTab("attachments");
    else if (activeTab === "attachments") setActiveTab("overview");
  };

  const {
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
    formatCurrency,
    formatDate,
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
  } = useItemPresentation(item);

  useEffect(() => {
    setActiveTab("overview");
  }, [item]);

  useEffect(() => {
    // Lock body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative flex h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-detail-heading"
          className={[
            "relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl",
            "bg-white shadow-2xl ring-1 ring-slate-900/10",
          ].join(" ")}
          ref={dialogRef}
        >
          {/* Header & Tabs Section */}
          <div className="flex-none border-b border-slate-200 bg-white">
            <div className="flex items-start justify-between p-6 sm:px-8">
              <div>
                <h3
                  id="item-detail-heading"
                  className="text-2xl font-semibold text-slate-900"
                >
                  {loading
                    ? "Lade Details..."
                    : item?.name || "Gegenstand Details"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Vollständige Ansicht des Inventargegenstands
                </p>
                {!loading && item?.wodis_inventory_number && (
                  <div
                    className={[
                      "mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs",
                      "font-semibold text-indigo-700",
                    ].join(" ")}
                  >
                    <span>Wodis Inventarnummer</span>
                    <span className="font-mono text-indigo-800">
                      {item.wodis_inventory_number}
                    </span>
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

            {/* Tabs */}
            <div className="px-6 sm:px-8">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => handleTabChange("overview")}
                  className={`${
                    activeTab === "overview"
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={activeTab === "overview" ? "page" : undefined}
                >
                  Übersicht
                </button>
                <button
                  onClick={() => handleTabChange("attachments")}
                  className={`${
                    activeTab === "attachments"
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={
                    activeTab === "attachments" ? "page" : undefined
                  }
                >
                  Anhänge{" "}
                  {attachments.length > 0 && (
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                      {attachments.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange("history")}
                  className={`${
                    activeTab === "history"
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  aria-current={activeTab === "history" ? "page" : undefined}
                >
                  Änderungshistorie
                </button>
              </nav>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div
            className="flex-1 overflow-y-auto bg-slate-50/50 p-6 sm:p-8"
            ref={scrollContainerRef}
          >
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
                {activeTab === "overview" && (
                  <ItemOverviewTab
                    item={item}
                    locationMap={locationMap}
                    tagMap={tagMap}
                    qrLoading={qrLoading}
                    qrError={qrError}
                    qrPreviewUrl={qrPreview?.url}
                    shareLink={shareLink}
                    copySuccess={copySuccess}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onRefreshQr={handleRefreshQr}
                    onDownloadQr={handleDownloadQr}
                    onCopyShareLink={handleCopyShareLink}
                  />
                )}

                {activeTab === "attachments" && (
                  <ItemAttachmentsTab
                    attachmentError={attachmentError}
                    attachments={attachments}
                    downloadingAttachmentId={downloadingAttachmentId}
                    onOpen={handleOpenAttachment}
                    onDownload={handleDownloadAttachment}
                  />
                )}

                {/* History Tab Content */}
                {activeTab === "history" && (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[300px]">
                    <ItemChangeHistory
                      changelog={changelog}
                      loading={changelogLoading}
                      error={changelogError}
                    />
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
                  <div
                    className={[
                      "flex flex-1 items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm",
                      "text-red-700 ring-1 ring-red-200 animate-in fade-in zoom-in-95 duration-200",
                    ].join(" ")}
                  >
                    <span className="font-medium mr-4">Wirklich löschen?</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleteLoading}
                        className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete?.()}
                        loading={deleteLoading}
                      >
                        Ja, löschen
                      </Button>
                    </div>
                  </div>
                ) : (
                  canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 px-2 sm:px-4"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      Gegenstand löschen
                    </Button>
                  )
                )}

                {/* Tab Navigation & Main Actions */}
                <div
                  className={`flex items-end gap-3 ${confirmingDelete ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Schließen
                  </Button>

                  <div className="mx-1 hidden h-10 w-px bg-slate-200 sm:block" />

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {activeTab !== "overview" && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handlePrevTab}
                          className="flex-1"
                        >
                          Zurück
                        </Button>
                      )}
                      {activeTab !== "history" && (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleNextTab}
                          className="flex-1"
                        >
                          Weiter
                        </Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={onEdit}
                      className="w-full"
                    >
                      Bearbeiten
                    </Button>
                  </div>
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
    document.body,
  );
};

export default ItemDetailView;
