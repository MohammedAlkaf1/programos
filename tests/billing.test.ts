import { describe, expect, it } from 'vitest';
import { addMonths, withinLimit, remaining, formatMoney } from '../src/lib/plan-math';
import { nextInvoiceNumber, fromMoyasar, moyasar } from '../src/lib/billing';

/** addMonths works in local time; comparing via toISOString() would shift the
 *  day on any machine east or west of UTC. */
const localDate = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');

describe('addMonths', () => {
  it('advances a normal date', () => {
    expect(localDate(addMonths(new Date(2026, 2, 15), 1))).toBe('2026-4-15');
  });

  it('clamps 31 January to the end of February rather than overflowing', () => {
    const result = addMonths(new Date(2026, 0, 31), 1);
    expect(result.getMonth()).toBe(1); // February, not March
    expect(result.getDate()).toBe(28);
  });

  it('handles a leap February', () => {
    const result = addMonths(new Date(2028, 0, 31), 1);
    expect(result.getDate()).toBe(29);
  });

  it('rolls over the year', () => {
    expect(addMonths(new Date(2026, 11, 10), 1).getFullYear()).toBe(2027);
  });
});

describe('plan limits', () => {
  it('allows usage below the cap', () => {
    expect(withinLimit(4, 10)).toBe(true);
  });

  it('blocks at the cap, not past it', () => {
    // 10 of 10 used means the next create must fail.
    expect(withinLimit(10, 10)).toBe(false);
    expect(withinLimit(11, 10)).toBe(false);
  });

  it('treats -1 as uncapped', () => {
    expect(withinLimit(999_999, -1)).toBe(true);
  });

  it('reports what is left, and null when uncapped', () => {
    expect(remaining(3, 10)).toBe(7);
    expect(remaining(12, 10)).toBe(0);
    expect(remaining(3, -1)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('renders halalas as riyals', () => {
    expect(formatMoney(89900, 'SAR', 'en')).toContain('899');
  });

  it('renders zero for a free plan', () => {
    expect(formatMoney(0, 'SAR', 'en')).toContain('0');
  });

  it('uses Western digits in Arabic so figures stay scannable', () => {
    expect(formatMoney(89900, 'SAR', 'ar')).toMatch(/899/);
  });
});

describe('nextInvoiceNumber', () => {
  const year = new Date().getFullYear();
  const fake = (highest: string | null) => ({
    invoice: { findFirst: async () => (highest ? { number: highest } : null) },
  });

  it('starts at 1 when nothing has been issued', async () => {
    expect(await nextInvoiceNumber(fake(null))).toBe(`INV-${year}-000001`);
  });

  it('continues from the highest number issued', async () => {
    expect(await nextInvoiceNumber(fake(`INV-${year}-000041`))).toBe(`INV-${year}-000042`);
  });

  /* The original implementation counted rows, so deleting or voiding an
     invoice made the next number collide with one still on the books. */
  it('does not reuse a number after an earlier invoice is removed', async () => {
    expect(await nextInvoiceNumber(fake(`INV-${year}-000002`))).toBe(`INV-${year}-000003`);
  });

  it('keeps the padding wide enough to sort lexicographically', async () => {
    const next = await nextInvoiceNumber(fake(`INV-${year}-000009`));
    expect(next).toBe(`INV-${year}-000010`);
    expect(next > `INV-${year}-000009`).toBe(true);
  });
});

describe('Moyasar mapping', () => {
  it('reads a paid invoice with our invoice id in the metadata', () => {
    expect(
      fromMoyasar({ id: 'inv_1', status: 'paid', amount: 149900, metadata: { invoice_id: 'our-1' } }),
    ).toEqual({ externalId: 'inv_1', invoiceId: 'our-1', status: 'paid', amount: 149900 });
  });

  it('treats expired, canceled and failed as failed and anything else as pending', () => {
    for (const status of ['expired', 'canceled', 'failed', 'voided']) {
      expect(fromMoyasar({ id: 'x', status, amount: 1, metadata: { invoice_id: 'i' } })?.status).toBe('failed');
    }
    expect(fromMoyasar({ id: 'x', status: 'initiated', amount: 1, metadata: { invoice_id: 'i' } })?.status).toBe('pending');
  });

  it('refuses an object that does not point at one of our invoices', () => {
    expect(fromMoyasar({ id: 'x', status: 'paid', amount: 1 })).toBeNull();
    expect(fromMoyasar({ status: 'paid', amount: 1, metadata: { invoice_id: 'i' } })).toBeNull();
  });

  it('unwraps the webhook envelope', () => {
    expect(
      moyasar.parseEvent?.({ type: 'invoice_paid', data: { id: 'inv_2', status: 'paid', amount: 49900, metadata: { invoice_id: 'our-2' } } }),
    ).toMatchObject({ externalId: 'inv_2', invoiceId: 'our-2', status: 'paid', amount: 49900 });
  });

  it('refuses to start a checkout without a secret key', async () => {
    const previous = process.env.MOYASAR_SECRET_KEY;
    delete process.env.MOYASAR_SECRET_KEY;
    await expect(
      moyasar.createCheckout({ tenantId: 't', invoiceId: 'i', amount: 100, currency: 'SAR', description: 'INV', returnUrl: 'http://localhost:3000/ar/billing' }),
    ).rejects.toMatchObject({ code: 'billingUnavailable' });
    if (previous) process.env.MOYASAR_SECRET_KEY = previous;
  });
});
