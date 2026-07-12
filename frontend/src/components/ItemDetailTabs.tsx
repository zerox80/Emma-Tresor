import React from "react";
import type { Item } from "../types/inventory";
import Button from "./common/Button";
import type { AttachmentView } from "./useItemPresentation";

interface OverviewTabProps {
  item: Item;
  locationMap: Record<number, string>;
  tagMap: Record<number, string>;
  qrLoading: boolean;
  qrError: string | null;
  qrPreviewUrl?: string;
  shareLink: string;
  copySuccess: boolean;
  formatCurrency: (value: string | null) => string;
  formatDate: (value: string | null) => string;
  onRefreshQr: () => void;
  onDownloadQr: () => void;
  onCopyShareLink: () => void;
}

export const ItemOverviewTab: React.FC<OverviewTabProps> = ({
  item,
  locationMap,
  tagMap,
  qrLoading,
  qrError,
  qrPreviewUrl,
  shareLink,
  copySuccess,
  formatCurrency,
  formatDate,
  onRefreshQr,
  onDownloadQr,
  onCopyShareLink,
}) => (
  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex flex-none flex-col items-center gap-4 sm:w-64">
        <div
          className={[
            "flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl",
            "border border-dashed border-slate-200 bg-slate-50 p-4",
          ].join(" ")}
        >
          {qrLoading && <span className="text-sm text-slate-500">QR-Code wird erstellt...</span>}
          {!qrLoading && qrPreviewUrl && (
            <img
              src={qrPreviewUrl}
              alt={`QR-Code für ${item.name ?? "Inventargegenstand"}`}
              className="h-full w-full object-contain"
            />
          )}
          {!qrLoading && !qrPreviewUrl && !qrError && (
            <span className="text-sm text-slate-500">QR-Code wird vorbereitet...</span>
          )}
          {!qrLoading && qrError && !qrPreviewUrl && (
            <Button type="button" variant="secondary" size="xs" onClick={onRefreshQr}>
              Neu laden
            </Button>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onDownloadQr}>
            QR-Code speichern
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCopyShareLink}
            disabled={!shareLink}
          >
            Link kopieren
          </Button>
          {copySuccess && <p className="text-center text-xs text-emerald-600">Kopiert!</p>}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-slate-900">Grundinformationen</h4>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Name" value={item.name} wide />
            {item.description && <Detail label="Beschreibung" value={item.description} wide />}
            <Detail label="Menge" value={`${item.quantity} Stück`} />
            <Detail label="Wert" value={formatCurrency(item.value)} />
            {item.purchase_date && <Detail label="Kaufdatum" value={formatDate(item.purchase_date)} />}
            {item.asset_tag && <Detail label="Asset-Tag" value={item.asset_tag} />}
          </dl>
        </div>
        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-lg font-semibold text-slate-900">Zuordnung</h4>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Standort" value={locationMap[item.location || 0] ?? "Kein Standort"} />
            {item.employee_name && <Detail label="Mitarbeiter" value={item.employee_name} />}
            {item.room_number && <Detail label="Raum Nr" value={item.room_number} />}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {item.tags.length > 0 ? (
                  item.tags.map((tagId) => (
                    <span key={tagId} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {tagMap[tagId] ?? `Tag ${tagId}`}
                    </span>
                  ))
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
);

const Detail: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? "sm:col-span-2" : undefined}>
    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900">{value}</dd>
  </div>
);

interface AttachmentsTabProps {
  attachmentError: string | null;
  attachments: AttachmentView[];
  downloadingAttachmentId: string | number | null;
  onOpen: (url: string) => void;
  onDownload: (attachment: AttachmentView) => void;
}

export const ItemAttachmentsTab: React.FC<AttachmentsTabProps> = ({
  attachmentError,
  attachments,
  downloadingAttachmentId,
  onOpen,
  onDownload,
}) => (
  <div className="min-h-[300px]">
    {attachmentError && (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
        {attachmentError}
      </div>
    )}
    {attachments.length > 0 ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attachments.map((attachment) => (
          <article
            key={attachment.key}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {attachment.type === "image" ? (
              <img src={attachment.previewUrl} alt={attachment.name} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-4xl" aria-hidden="true">
                {attachment.type === "pdf" ? "📄" : "📁"}
              </div>
            )}
            <div className="flex flex-1 flex-col justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
                  {attachment.name}
                </p>
                <p className="text-xs uppercase text-slate-500">{attachment.extension}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="xs" onClick={() => onOpen(attachment.previewUrl)}>
                  Öffnen
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  loading={downloadingAttachmentId === attachment.key}
                  onClick={() => onDownload(attachment)}
                >
                  Download
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
        Keine Anhänge vorhanden
      </div>
    )}
  </div>
);
