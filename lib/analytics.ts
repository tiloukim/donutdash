// Lightweight, provider-agnostic analytics + UTM attribution.
//
// No tracking library is installed. `track()` pushes a normalized event onto
// window.dataLayer (so connecting GA4 / Google Tag Manager later is just adding
// the tag script — no code changes), and always attaches the captured UTM.
// Recommended provider to connect later: GA4 via GTM (free, and dataLayer is
// already populated here). Swap/add a network sink inside `track()` if you'd
// rather log to your own Supabase events table.

type Props = Record<string, unknown>
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const STORE = 'dd_attribution'

// Capture UTM params on landing and persist them for the whole funnel.
// First-touch wins (don't overwrite an earlier campaign on internal navigation).
export function captureUtm() {
  if (typeof window === 'undefined') return
  try {
    const p = new URLSearchParams(window.location.search)
    const found: Record<string, string> = {}
    for (const k of UTM_KEYS) { const v = p.get(k); if (v) found[k] = v }
    if (Object.keys(found).length && !localStorage.getItem(STORE)) {
      localStorage.setItem(STORE, JSON.stringify({ ...found, landing: window.location.pathname, ts: Date.now() }))
    }
  } catch { /* storage blocked */ }
}

export function getUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') } catch { return {} }
}

// Emit a funnel event. Call from: landing_page_view, address_entered,
// shops_viewed, shop_selected, menu_viewed, item_added_to_cart,
// checkout_started, order_completed, promo_code_used.
export function track(event: string, props: Props = {}) {
  if (typeof window === 'undefined') return
  const payload = { event, ...props, ...getUtm() }
  try {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push(payload)
    if (process.env.NODE_ENV !== 'production') console.debug('[analytics]', event, payload)
  } catch { /* noop */ }
}
