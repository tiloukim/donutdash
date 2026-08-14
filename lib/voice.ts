import { toE164 } from './sms'

// Place an outbound TeXML call via Telnyx that runs an IVR (the Url returns
// TeXML). Used to phone a shop when they haven't accepted a new order.
// Needs TELNYX_TEXML_APP_ID (the TeXML Application / connection id),
// TELNYX_PHONE_NUMBER (caller id), and TELNYX_API_KEY.
export async function placeTexmlCall(toPhone: string, texmlUrl: string): Promise<boolean> {
  const appId = process.env.TELNYX_TEXML_APP_ID
  const from = process.env.TELNYX_PHONE_NUMBER
  const key = process.env.TELNYX_API_KEY
  const to = toE164(toPhone)
  if (!appId || !from || !key || !to) {
    console.warn('[voice] placeTexmlCall missing config', { appId: !!appId, from: !!from, key: !!key, to })
    return false
  }
  try {
    const res = await fetch(`https://api.telnyx.com/v2/texml/calls/${appId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ To: to, From: from, Url: texmlUrl }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[voice] Telnyx call failed', res.status, body.slice(0, 400))
      return false
    }
    return true
  } catch (e) {
    console.error('[voice] Telnyx call error', e)
    return false
  }
}

// Escalation call to a shop for a specific order (runs the accept/reject IVR).
export function callShopToAccept(toPhone: string, orderId: string): Promise<boolean> {
  const url = `https://donutdash.app/api/telnyx/voice/order-accept?order_id=${encodeURIComponent(orderId)}`
  return placeTexmlCall(toPhone, url)
}
