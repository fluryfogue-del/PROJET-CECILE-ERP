import { CurrencyCode } from '../types/erp';

export function formatMoney(amount: number | undefined | null, currency: CurrencyCode = 'XAF'): string {
  const value = Number.isFinite(amount) ? Number(amount) : 0;
  if (currency === 'XAF' || currency === 'XOF') {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(value))} ${currency}`;
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(n: number | undefined | null): string {
  const value = Number.isFinite(n) ? Number(n) : 0;
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatDateFr(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function generateDocNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}-${rand}`;
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
