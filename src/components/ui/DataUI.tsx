import React from 'react';
import { X } from 'lucide-react';

export const StatusLabel: React.FC<{
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}> = ({ label, tone = 'neutral' }) => {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    neutral:
      'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-[#262933]',
    info:
      'text-[#E03212] dark:text-[#FF6B4A] bg-[#FC3F1D]/10 dark:bg-[#FC3F1D]/15 border-[#FC3F1D]/25 dark:border-[#FC3F1D]/30',
    success:
      'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70',
    warning:
      'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70',
    danger:
      'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-md border whitespace-nowrap ${toneClasses[tone]}`}
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
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#E6E8EC] dark:border-[#262933]">
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[#111216] dark:text-white">
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
  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#ECEEF2] dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-xl">
    {tabs.map((tab) => {
      const active = tab.id === activeId;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            active
              ? 'bg-white dark:bg-[#0D0E12] text-[#FC3F1D] border border-[#E6E8EC] dark:border-[#2E323E] shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-[#111216] dark:hover:text-white'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0E12]/65 backdrop-blur-[2px] p-4">
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl max-h-[90vh] flex flex-col shadow-2xl`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8EC] dark:border-[#262933]">
          <h3 className="font-display text-base font-bold text-[#111216] dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 text-slate-500 hover:text-[#111216] dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
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
  <div className="py-12 px-6 text-center border border-dashed border-[#D8DCE3] dark:border-[#2A2E39] rounded-2xl bg-white dark:bg-[#16181F]">
    <p className="text-sm font-bold text-[#111216] dark:text-white">{title}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
      {description}
    </p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 px-4 py-2 text-xs font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded-xl transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0D0E12] border border-[#D8DCE3] dark:border-[#2A2E39] rounded-xl text-[#111216] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#FC3F1D] focus:border-transparent transition-shadow';

export const labelCls = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export const btnPrimaryCls =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer';

export const btnSecondaryCls =
  'inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] text-[#111216] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer';
