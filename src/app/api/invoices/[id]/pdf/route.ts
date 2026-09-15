import { NextRequest, NextResponse } from 'next/server';
import { actor } from '@/lib/access';
import { isOperator } from '@/lib/operator-access';
import { db } from '@/lib/db';
import { invoiceHtml } from '@/lib/invoice-document';
import { renderPdf } from '@/lib/pdf';
import { captureError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/:id/pdf?locale=ar|en&format=pdf|html
 *
 * A tenant admin downloads their own invoices; a platform operator any
 * invoice. The HTML form exists for previewing the layout and as a fallback
 * when no browser is available on the server.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  const invoice = await db.invoice.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
  if (!invoice) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  // A tenant admin sees their own tenant's invoices; a platform operator sees every invoice.
  let allowed = false;
  try {
    const a = await actor();
    allowed = a.role === 'Admin' && a.tenantId === invoice.tenantId;
  } catch {}
  if (!allowed) allowed = await isOperator();
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const tenant = await db.tenant.findUnique({ where: { id: invoice.tenantId } });
  if (!tenant) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const html = await invoiceHtml({ invoice, tenant, plan: invoice.subscription.plan, locale });
  const filename = `${invoice.number.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;

  if (request.nextUrl.searchParams.get('format') === 'html') {
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  try {
    const pdf = await renderPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    await captureError(error, { source: 'api', path: '/api/invoices/pdf', context: { invoice: invoice.number } });
    // No browser on this host: hand back the printable HTML so the customer still gets a document.
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-pdf-fallback': 'html' } });
  }
}
