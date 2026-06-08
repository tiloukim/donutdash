// Client-side engagement tracker for the unclaimed-shop pitch surface.
// Fire-and-forget: every call should survive a page navigation, never
// block the UI, and silently drop on failure (we never want a busted
// analytics call to break the user's actual journey).
//
// Prefers navigator.sendBeacon — it queues the request with the browser
// and returns immediately, surviving even an immediate navigation.
// Falls back to fetch with keepalive: true for older browsers (which
// gives near-identical behavior). Both are no-ops on the server side
// (SSR / Node) — the caller is expected to gate on typeof window.

export type EngagementKind =
  | 'page_view'
  | 'lost_order_click'
  | 'claim_link_click'
  | 'menu_item_view'
  | 'search_impression'

interface TrackPayload {
  shop_id: string
  kind: EngagementKind
  path?: string
}

function sendBody(body: string): void {
  if (typeof window === 'undefined') return
  const url = '/api/track/engagement'
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics must NEVER throw into the calling component.
  }
}

export function trackEngagement(input: TrackPayload): void {
  if (typeof window === 'undefined') return
  sendBody(JSON.stringify({
    shop_id: input.shop_id,
    kind: input.kind,
    path: input.path ?? window.location.pathname,
  }))
}

// Batch shape — used for search_impression where a single page render
// generates one event per visible shop. Folding all of them into a
// single sendBeacon avoids burning 30+ network requests per page load.
export function trackEngagementBatch(events: TrackPayload[]): void {
  if (typeof window === 'undefined' || events.length === 0) return
  const path = window.location.pathname
  sendBody(JSON.stringify({
    events: events.map((e) => ({
      shop_id: e.shop_id,
      kind: e.kind,
      path: e.path ?? path,
    })),
  }))
}
