import React from 'react';
import { X } from 'lucide-react';

export const StatusLabel: React.FC<{
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}> = ({ label, tone = 'neutral' }) => {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    neutral: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    info: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
    success: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    warning: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    danger: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const SegmentedTabs: React.FC<{
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeId: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeId, onChange }) => (
  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
    {tabs.map((tab) => {
      const active = tab.id === activeId;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            active
              ? 'bg-white dark:bg-[#0B1426] text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {tab.label}
          {typeof tab.count === 'number' ? (
            <span className="ml-1.5 font-mono text-[11px] opacity-75">{tab.count}</span>
          ) : null}
        </button>
      );
    })}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, title, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4">
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="py-12 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0B1426]">
    <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const inputCls =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';

export const labelCls = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1';

export const btnPrimaryCls =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50';

export const btnSecondaryCls =
  'inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0';
