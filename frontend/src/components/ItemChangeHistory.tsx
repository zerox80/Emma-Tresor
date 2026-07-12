import React from 'react';
import type { ItemChangeLog } from '../types/inventory';

interface ItemChangeHistoryProps {
  changelog: ItemChangeLog[];
  loading: boolean;
  error: string | null;
}

interface FieldChange {
  old: unknown;
  new: unknown;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ACTION_PRESENTATION: Record<string, { icon: string; color: string }> = {
  create: { icon: '➕', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  update: { icon: '✏️', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  delete: { icon: '🗑️', color: 'bg-red-50 border-red-200 text-red-700' },
};

const DEFAULT_ACTION_PRESENTATION = {
  icon: '📝',
  color: 'bg-slate-50 border-slate-200 text-slate-700',
};

const FIELD_NAMES: Record<string, string> = {
  name: 'Name',
  description: 'Beschreibung',
  quantity: 'Menge',
  purchase_date: 'Kaufdatum',
  value: 'Wert',
  location_id: 'Standort',
  wodis_inventory_number: 'Wodis Inventarnummer',
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? dateString : DATE_FORMATTER.format(date);
};

const formatRelativeTime = (dateString: string): string => {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return dateString;
  }

  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
  return formatDate(dateString);
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  return String(value);
};

const isFieldChange = (value: unknown): value is FieldChange =>
  typeof value === 'object' && value !== null && 'old' in value && 'new' in value;

const renderChanges = (changes: Record<string, unknown>, action: string): React.ReactNode => {
  if (action === 'create') {
    return <p className="text-sm text-slate-600">Gegenstand wurde erstellt</p>;
  }

  if (action === 'delete') {
    return <p className="text-sm text-slate-600">Gegenstand wurde gelöscht</p>;
  }

  const changeEntries = Object.entries(changes);
  if (changeEntries.length === 0) {
    return <p className="text-sm text-slate-500 italic">Keine Änderungen protokolliert</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {changeEntries.map(([field, change]) => {
        if (isFieldChange(change)) {
          return (
            <div key={field} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">{FIELD_NAMES[field] ?? field}</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-xs text-red-700">
                  {formatValue(change.old)}
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-700">
                  {formatValue(change.new)}
                </span>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

const ItemChangeHistory: React.FC<ItemChangeHistoryProps> = ({ changelog, loading, error }) => {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
          <p className="text-sm text-slate-600">Lade Änderungshistorie...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (changelog.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-900">Keine Änderungen protokolliert</p>
        <p className="mt-1 text-sm text-slate-500">
          Für diesen Gegenstand wurden bisher keine Änderungen aufgezeichnet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {changelog.map((log) => {
        const presentation = ACTION_PRESENTATION[log.action] ?? DEFAULT_ACTION_PRESENTATION;
        return (
          <div key={log.id} className={`rounded-xl border p-4 transition-all ${presentation.color}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-label={log.action_display}>
                  {presentation.icon}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="font-semibold text-slate-900">{log.action_display}</h5>
                    {log.user_username && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {log.user_username}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600" title={formatDate(log.created_at)}>
                    {formatRelativeTime(log.created_at)}
                  </p>
                  {renderChanges(log.changes, log.action)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ItemChangeHistory;
