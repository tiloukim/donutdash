// Shared receipt rendering + data fetch, used by:
//   - POST /api/pos/receipt/email  (emailed via Resend)
//   - GET  /receipt/[id]           (public web receipt; the SMS links here)
// Keeping one source of truth means the emailed and web receipts always match.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReceiptOrder {
  id: string
  shop_id: string
  short_code: string | null
  subtotal: number
  tax: number
  tip: number | null
  total: number
  payment_method: string | null
  cash_received: number | null
  change_given: number | null
  card_brand: string | null
  card_last4: string | null
  cash_discount_amount: number | null
  created_at: string
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number | null
  special_instructions: string | null
}

export interface ReceiptShop {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
}

export interface ReceiptData {
  order: ReceiptOrder
  items: ReceiptItem[]
  shop: ReceiptShop
}

function fmtMoney(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toFixed(2)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Card network badge for the Payment row — a brand-colored pill (works in
// every email client, unlike SVG/remote logos) plus the masked last 4.
function cardBrandHtml(brand: string | null, last4: string | null): string {
  const key = (brand ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const brands: Record<string, { label: string; bg: string }> = {
    visa: { label: 'VISA', bg: '#1A1F71' },
    mastercard: { label: 'Mastercard', bg: '#EB001B' },
    amex: { label: 'AMEX', bg: '#1F72CD' },
    americanexpress: { label: 'AMEX', bg: '#1F72CD' },
    discover: { label: 'DISCOVER', bg: '#FF6000' },
    diners: { label: 'Diners Club', bg: '#0079BE' },
    dinersclub: { label: 'Diners Club', bg: '#0079BE' },
    jcb: { label: 'JCB', bg: '#0B4EA2' },
    unionpay: { label: 'UnionPay', bg: '#005BAC' },
  }
  const match = brands[key]
  const label = match?.label ?? (brand ? escapeHtml(brand.toUpperCase()) : 'Card')
  const bg = match?.bg ?? '#1F2937'
  const badge = `<span style="display:inline-block;background:${bg};color:#fff;font-size:11px;font-weight:800;letter-spacing:0.5px;padding:3px 9px;border-radius:5px;vertical-align:middle">${label}</span>`
  const tail = last4
    ? `<span style="color:#1F2937;font-weight:600;margin-left:8px;vertical-align:middle">•••• ${escapeHtml(last4)}</span>`
    : ''
  return `${badge}${tail}`
}

/** Full HTML receipt document. `opts.sentToEmail` adds the "Sent to …" footer
 *  line for the emailed variant; omit it for the web variant. */
export function buildReceiptHtml(
  order: ReceiptOrder,
  items: ReceiptItem[],
  shop: ReceiptShop,
  opts: { sentToEmail?: string } = {},
): string {
  const cityState = [shop.city, shop.state].filter(Boolean).join(', ')
  const cityStateZip = shop.zip ? `${cityState} ${shop.zip}`.trim() : cityState
  const shopUrl = `https://donutdash.app/shops/${encodeURIComponent(shop.slug)}`
  const placed = new Date(order.created_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  const itemRows = items
    .map((it) => {
      const lineTotal = fmtMoney((it.price ?? 0) * it.quantity)
      const note = it.special_instructions
        ? `<div style="color:#6B7280;font-size:13px;margin-top:2px;font-style:italic">"${escapeHtml(it.special_instructions)}"</div>`
        : ''
      return `
        <tr>
          <td style="padding:5px 0;border-bottom:1px solid #F4D5E2">
            <div style="color:#1F2937;font-weight:600">${it.quantity}× ${escapeHtml(it.name)}</div>
            ${note}
          </td>
          <td style="padding:5px 0;border-bottom:1px solid #F4D5E2;text-align:right;color:#1F2937;font-weight:600">${lineTotal}</td>
        </tr>
      `
    })
    .join('')

  const hasDiscount = order.cash_discount_amount != null && Number(order.cash_discount_amount) > 0
  const discountRow = hasDiscount
    ? `
      <tr>
        <td style="padding:4px 0;color:#EC1B7E;font-weight:600">Cash Discount</td>
        <td style="padding:4px 0;text-align:right;color:#EC1B7E;font-weight:600">−${fmtMoney(order.cash_discount_amount)}</td>
      </tr>
    `
    : ''

  const tipRow = order.tip && Number(order.tip) > 0
    ? `
      <tr>
        <td style="padding:4px 0;color:#6B7280">Tip</td>
        <td style="padding:4px 0;text-align:right;color:#1F2937">${fmtMoney(order.tip)}</td>
      </tr>
    `
    : ''

  const isCard = order.payment_method !== 'cash'
  const paymentValueHtml = isCard
    ? cardBrandHtml(order.card_brand, order.card_last4)
    : '<span style="color:#1F2937;font-weight:600">Cash</span>'
  const cashBlock = order.payment_method === 'cash' && order.cash_received != null
    ? `
      <tr>
        <td style="padding:4px 0;color:#6B7280">Cash tendered</td>
        <td style="padding:4px 0;text-align:right;color:#1F2937">${fmtMoney(order.cash_received)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6B7280">Change given</td>
        <td style="padding:4px 0;text-align:right;color:#1F2937">${fmtMoney(order.change_given)}</td>
      </tr>
    `
    : ''

  const sentToLine = opts.sentToEmail
    ? `Sent to ${escapeHtml(opts.sentToEmail)}<br />`
    : ''

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Receipt from ${escapeHtml(shop.name)}</title>
    <style>
      /* The card is width:100% capped at 560px with box-sizing:border-box so
         its padding never pushes the amount column off a narrow phone screen.
         Tighten padding + header on small screens so nothing gets clipped. */
      @media only screen and (max-width: 480px) {
        .rcpt-card { padding: 20px !important; }
        .rcpt-shop { font-size: 22px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#FFF5F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFF5F8;padding:24px 12px;box-sizing:border-box">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" class="rcpt-card" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #F4D5E2;padding:32px;box-sizing:border-box">
            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom:20px;border-bottom:1px solid #F4D5E2">
                <div class="rcpt-shop" style="font-size:28px;font-weight:800;color:#1F2937;letter-spacing:0.3px">${escapeHtml(shop.name)}</div>
                ${shop.address ? `<div style="color:#6B7280;margin-top:6px">${escapeHtml(shop.address)}</div>` : ''}
                ${cityStateZip ? `<div style="color:#6B7280">${escapeHtml(cityStateZip)}</div>` : ''}
                ${shop.phone ? `<div style="color:#6B7280">${escapeHtml(shop.phone)}</div>` : ''}
              </td>
            </tr>

            <!-- Meta -->
            <tr>
              <td align="center" style="padding:18px 0">
                <div style="color:#6B7280;font-size:13px">${placed}</div>
                ${order.short_code ? `<div style="font-weight:800;color:#1F2937;margin-top:4px">Order #${escapeHtml(order.short_code)}</div>` : ''}
              </td>
            </tr>

            <!-- Items -->
            <tr>
              <td style="padding-top:2px">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <thead>
                    <tr>
                      <th style="text-align:left;color:#6B7280;font-size:11px;letter-spacing:0.6px;padding-bottom:6px;border-bottom:1px solid #F4D5E2">ITEM</th>
                      <th style="text-align:right;color:#6B7280;font-size:11px;letter-spacing:0.6px;padding-bottom:6px;border-bottom:1px solid #F4D5E2">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Totals -->
            <tr>
              <td style="padding-top:6px">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:4px 0;color:#6B7280">Subtotal</td>
                    <td style="padding:4px 0;text-align:right;color:#1F2937">${fmtMoney(order.subtotal)}</td>
                  </tr>
                  ${discountRow}
                  <tr>
                    <td style="padding:4px 0;color:#6B7280">Tax</td>
                    <td style="padding:4px 0;text-align:right;color:#1F2937">${fmtMoney(order.tax)}</td>
                  </tr>
                  ${tipRow}
                  <tr>
                    <td colspan="2" style="padding-top:12px;border-top:1px solid #F4D5E2"></td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#1F2937;font-weight:800;font-size:18px">Total</td>
                    <td style="padding:4px 0;text-align:right;color:#1F2937;font-weight:800;font-size:18px">${fmtMoney(order.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Payment -->
            <tr>
              <td style="padding-top:18px;border-top:1px solid #F4D5E2">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:4px 0;color:#6B7280">Payment</td>
                    <td style="padding:4px 0;text-align:right">${paymentValueHtml}</td>
                  </tr>
                  ${cashBlock}
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:24px">
                <div style="font-size:18px;font-weight:700;color:#1F2937">Thank you!</div>
                <div style="color:#6B7280;font-size:13px;margin-top:4px">Come back soon.</div>
                <a href="${shopUrl}" style="display:inline-block;margin-top:16px;background:#EC1B7E;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:9px">Order again from ${escapeHtml(shop.name)}</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:18px;border-top:1px solid #F4D5E2;color:#9CA3AF;font-size:11px;line-height:18px">
                ${sentToLine}
                Powered by <a href="https://www.donutdashtech.com" style="color:#EC1B7E;font-weight:700;text-decoration:none">DonutDash&trade; POS</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Fetch order + items + shop for a receipt. Returns null if the order isn't
 *  found. NO authorization — callers that need it (the email route) enforce it
 *  separately; the public web route is intentionally open (order id is an
 *  unguessable UUID). Pass a service-role client. */
export async function fetchReceiptData(
  svc: SupabaseClient,
  orderId: string,
): Promise<ReceiptData | null> {
  const { data: order } = await svc
    .from('dd_orders')
    .select(`
      id, shop_id, short_code, subtotal, tax, tip, total,
      payment_method, cash_received, change_given,
      card_brand, card_last4, cash_discount_amount, created_at
    `)
    .eq('id', orderId)
    .maybeSingle<ReceiptOrder>()
  if (!order) return null

  const [itemsRes, shopRes] = await Promise.all([
    svc
      .from('dd_order_items')
      .select('name, quantity, price, special_instructions')
      .eq('order_id', orderId),
    svc
      .from('dd_shops')
      .select('id, name, slug, address, city, state, zip, phone')
      .eq('id', order.shop_id)
      .single<ReceiptShop>(),
  ])
  if (!shopRes.data) return null

  return {
    order,
    items: (itemsRes.data ?? []) as ReceiptItem[],
    shop: shopRes.data,
  }
}
