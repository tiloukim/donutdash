import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push-server'

// Send a push notification to a specific user. Internal/server-side only.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, title, body, url, tag } = await req.json()
  if (!userId || !title) {
    return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 })
  }

  const sent = await sendPushToUser(userId, { title, body, url, tag })
  return NextResponse.json({ sent })
}
