import { createServiceClient } from '@/lib/supabase/server'
import { buildReceiptHtml, fetchReceiptData } from '@/lib/receipt'

// GET /receipt/[id] — public web view of a POS receipt. The texted (SMS)
// receipt links here so the customer sees the full styled receipt (same HTML
// as the emailed one). No auth: the id is an unguessable order UUID, and the
// page is noindex. Returns raw text/html (not wrapped in the site layout).

export const dynamic = 'force-dynamic'

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Receipt not found</title>
  </head>
  <body style="margin:0;padding:0;background:#FFF5F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:420px;margin:80px auto;padding:32px;background:#fff;border:1px solid #F4D5E2;border-radius:12px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#1F2937">Receipt not found</div>
      <div style="color:#6B7280;font-size:14px;margin-top:8px;line-height:20px">This receipt link is invalid or has expired.</div>
      <a href="https://donutdash.app" style="display:inline-block;margin-top:20px;color:#EC1B7E;font-weight:700;text-decoration:none">Go to DonutDash</a>
    </div>
  </body>
</html>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderId = String(id ?? '').trim()

  const htmlHeaders = {
    'content-type': 'text/html; charset=utf-8',
    // Receipts are per-customer + can change (refund/void); don't cache.
    'cache-control': 'private, no-store',
    'x-robots-tag': 'noindex',
  }

  if (!orderId) {
    return new Response(notFoundHtml(), { status: 404, headers: htmlHeaders })
  }

  const svc = createServiceClient()
  const receipt = await fetchReceiptData(svc, orderId)
  if (!receipt) {
    return new Response(notFoundHtml(), { status: 404, headers: htmlHeaders })
  }

  const html = buildReceiptHtml(receipt.order, receipt.items, receipt.shop)
  return new Response(html, { status: 200, headers: htmlHeaders })
}
