import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Send push notification to a specific user
export async function POST(req: NextRequest) {
  // Only allow internal calls (admin or server-side)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, title, body, url, tag } = await req.json()
  if (!userId || !title) {
    return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 })
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@donutdash.app'

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

  const svc = createServiceClient()
  const { data: subs } = await svc
    .from('dd_push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({ title, body, url, tag })
  let sent = 0
  const staleEndpoints: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      )
      sent++
    } catch (err: any) {
      // Remove expired/invalid subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        staleEndpoints.push(sub.endpoint)
      }
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await svc.from('dd_push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return NextResponse.json({ sent })
}
