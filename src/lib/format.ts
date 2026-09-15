import type { Locale } from '@/i18n/dictionary';

/** Moments are stored in UTC and always shown in Riyadh time (NFR-08), whatever the viewer's device says. */
export const TIME_ZONE = 'Asia/Riyadh';

const intlLocale = (locale: Locale) => (locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB');

export function formatDate(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return '…';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '…';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return '…';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '…';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatNumber(value: number | null | undefined, locale: Locale, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '…';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

/** A missing denominator renders as N/A, never as 0% (section 14). */
export function formatPercent(value: number | null | undefined, locale: Locale, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return `${formatNumber(value, locale, digits)}%`;
}

export function formatSigned(value: number | null | undefined, locale: Locale, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '…';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), locale, digits)}`;
}

/** Value formatted for an <input type="datetime-local"> in the viewer's local time. */
export function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function relativeDays(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
}

export function csvCell(value: unknown) {
  let cell = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
