/**
 * Pure billing helpers — no database, no server-only imports, so client
 * components can use them. Anything that touches Prisma belongs in
 * `billing.ts`, which is server-only.
 */

/* Amounts are integers in the currency's minor unit (halalas for SAR).
   Never floats: 0.1 + 0.2 must not decide what a customer owes. */

export function formatMoney(minor: number, currency: string, locale: 'ar' | 'en') {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/* Saudi VAT. Plan prices are quoted before tax (the pricing page says so), so
   every invoice carries the net, the tax and the total separately. The rate
   is read once per process from VAT_RATE (a fraction, default 0.15); 0
   switches tax off for markets without it. */
export const VAT_RATE = (() => {
  const raw = Number(process.env.VAT_RATE ?? '0.15');
  return Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : 0.15;
})();

export function invoiceAmounts(net: number, rate = VAT_RATE) {
  const vat = Math.round(net * rate);
  return { netAmount: net, vatAmount: vat, amount: net + vat };
}

/** Older invoices were stored as a single amount; treat them as tax free. */
export function invoiceBreakdown(invoice: { amount: number; netAmount?: number; vatAmount?: number }) {
  if (!invoice.netAmount && !invoice.vatAmount) return { netAmount: invoice.amount, vatAmount: 0, amount: invoice.amount };
  return { netAmount: invoice.netAmount ?? invoice.amount, vatAmount: invoice.vatAmount ?? 0, amount: invoice.amount };
}

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const DUE_DAYS = 14;

export const WRITABLE_STATUSES = ['Trialing', 'Active', 'PastDue'] as const;

export type PlanLimits = {
  maxPrograms: number;
  maxMembers: number;
  maxEnrollments: number;
  features: string[];
};

export type BillingState = {
  status: string;
  planCode: string;
  planNameAr: string;
  planNameEn: string;
  priceMonthly: number;
  currency: string;
  limits: PlanLimits;
  usage: { programs: number; members: number; enrollments: number };
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  daysLeft: number | null;
  version: number;
};

/** `-1` means the plan does not cap this resource. */
export function withinLimit(used: number, limit: number) {
  return limit < 0 || used < limit;
}

export function remaining(used: number, limit: number) {
  return limit < 0 ? null : Math.max(0, limit - used);
}

export function addMonths(from: Date, months: number) {
  const date = new Date(from);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  // Clamp 31 Jan + 1 month to the last day of February rather than 3 March.
  if (date.getDate() < day) date.setDate(0);
  return date;
}
