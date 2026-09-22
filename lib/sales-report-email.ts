// Sales-report email: the figures it needs, and how it renders.
//
// Extracted from the POS "email this report" route because the nightly cron
// sends the same report and must send the SAME report. Two builders would
// drift, and the owner comparing last night's email against one they sent
// themselves from the register would be looking at two different documents
// describing one day.
//
// Nothing here talks to a database or to Resend — it takes numbers and
// returns HTML, so both callers keep their own auth and their own way of
// arriving at the figures.

export interface SalesReportBody {
  email: string
  shopId: string
  periodLabel: string
  compareLabel: string
  gross: number
  net: number
  refunds: number
  count: number
  averageSale: number
  cashTotal: number
  cardTotal: number
  grossChange: number | null
  netChange: number | null
  countChange: number | null
  avgChange: number | null
  cashChange: number | null
  cardChange: number | null
}

export interface ShopRow {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtPct(p: number | null): string {
  if (p == null) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function pctColor(p: number | null): string {
  if (p == null) return '#9CA3AF'
  return p >= 0 ? '#10B981' : '#EF4444'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string, change: number | null, valueBold = false): string {
  const valueStyle = valueBold
    ? 'font-weight:800;color:#1F2937;font-size:18px'
    : 'font-weight:600;color:#1F2937;font-size:16px'
  return `
    <tr>
      <td style="padding:8px 0;color:#6B7280;font-size:14px">${escapeHtml(label)}</td>
      <td style="padding:8px 0;text-align:right;${valueStyle}">${escapeHtml(value)}</td>
      <td style="padding:8px 0 8px 16px;text-align:right;color:${pctColor(change)};font-size:13px;font-weight:700;min-width:60px">${escapeHtml(fmtPct(change))}</td>
    </tr>
  `
}

export function buildHtml(body: SalesReportBody, shop: ShopRow): string {
  const cityState = [shop.city, shop.state].filter(Boolean).join(', ')
  const cityStateZip = shop.zip ? `${cityState} ${shop.zip}`.trim() : cityState

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sales report — ${escapeHtml(shop.name)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FFF5F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFF5F8;padding:24px 0">
      <tr><td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background:#fff;border-radius:12px;border:1px solid #F4D5E2;padding:32px">

          <!-- Header -->
          <tr><td align="center" style="padding-bottom:20px;border-bottom:1px solid #F4D5E2">
            <div style="font-size:28px;font-weight:800;color:#1F2937;letter-spacing:0.3px">${escapeHtml(shop.name)}</div>
            ${shop.address ? `<div style="color:#6B7280;margin-top:6px">${escapeHtml(shop.address)}</div>` : ''}
            ${cityStateZip ? `<div style="color:#6B7280">${escapeHtml(cityStateZip)}</div>` : ''}
            ${shop.phone ? `<div style="color:#6B7280">${escapeHtml(shop.phone)}</div>` : ''}
          </td></tr>

          <!-- Period -->
          <tr><td align="center" style="padding:18px 0">
            <div style="font-size:11px;font-weight:800;color:#EC1B7E;letter-spacing:1px;text-transform:uppercase">SALES REPORT</div>
            <div style="font-size:22px;font-weight:800;color:#1F2937;margin-top:6px">${escapeHtml(body.periodLabel)}</div>
            <div style="color:#6B7280;font-size:13px;margin-top:4px">${escapeHtml(body.compareLabel)}</div>
          </td></tr>

          <!-- Summary -->
          <tr><td style="padding-top:8px">
            <div style="font-size:11px;font-weight:800;color:#6B7280;letter-spacing:0.6px;padding-bottom:8px;border-bottom:1px solid #F4D5E2">SUMMARY</div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${row('Gross sales',  fmtMoney(body.gross),    body.grossChange)}
              ${row('Net sales',    fmtMoney(body.net),      body.netChange, true)}
              ${row('Refunds',      fmtMoney(body.refunds),  null)}
            </table>
          </td></tr>

          <!-- Volume -->
          <tr><td style="padding-top:20px">
            <div style="font-size:11px;font-weight:800;color:#6B7280;letter-spacing:0.6px;padding-bottom:8px;border-bottom:1px solid #F4D5E2">VOLUME</div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${row('Sales count',  body.count.toString(),         body.countChange)}
              ${row('Average sale', fmtMoney(body.averageSale),    body.avgChange)}
            </table>
          </td></tr>

          <!-- Tender -->
          <tr><td style="padding-top:20px">
            <div style="font-size:11px;font-weight:800;color:#6B7280;letter-spacing:0.6px;padding-bottom:8px;border-bottom:1px solid #F4D5E2">TENDER</div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${row('Cash', fmtMoney(body.cashTotal), body.cashChange)}
              ${row('Card', fmtMoney(body.cardTotal), body.cardChange)}
            </table>
          </td></tr>

          <!-- Footer -->
          <tr><td align="center" style="padding-top:24px;border-top:1px solid #F4D5E2;color:#9CA3AF;font-size:11px;line-height:18px">
            Sent ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}<br />
            Powered by <a href="https://www.donutdashtech.com" style="color:#EC1B7E;font-weight:700;text-decoration:none">DonutDash&trade; POS</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

