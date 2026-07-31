import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

// Server-side web push. Kept separate from lib/push-notifications.ts (which is
// a client helper that touches `navigator`) so server routes never pull the
// browser code — and vice versa.

let vapidConfigured = false
function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@donutdash.app'
  if (!pub || !priv) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(email, pub, priv)
    vapidConfigured = true
  }
  return true
}

export interface PushMessage {
  title: string
  body?: string
  url?: string
  tag?: string
}

/**
 * Send a web push to every device a user has subscribed. Safe to call
 * fire-and-forget from any Node route: it no-ops (returns 0) when VAPID isn't
 * configured or the user has no subscriptions, and prunes dead endpoints
 * (410/404) so the table doesn't accumulate stale devices.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  if (!userId || !ensureVapid()) return 0

  const svc = createServiceClient()
  const { data: subs } = await svc
    .from('dd_push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (!subs?.length) return 0

  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag })
  const stale: string[] = []
  let sent = 0

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload,
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code === 410 || code === 404) stale.push(sub.endpoint)
    }
  }))

  if (stale.length) await svc.from('dd_push_subscriptions').delete().in('endpoint', stale)
  return sent
}
