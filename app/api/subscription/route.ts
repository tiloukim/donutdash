import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', authUser.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: sub } = await svc.from('dd_subscriptions').select('*').eq('user_id', ddUser.id).single()

    if (!sub || sub.status !== 'active') {
      return NextResponse.json({ subscribed: false })
    }

    // Check expiry
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      await svc.from('dd_subscriptions').update({ status: 'expired' }).eq('id', sub.id)
      return NextResponse.json({ subscribed: false, status: 'expired' })
    }

    return NextResponse.json({
      subscribed: true,
      plan: sub.plan,
      status: sub.status,
      started_at: sub.started_at,
      expires_at: sub.expires_at,
    })
  } catch (err) {
    console.error('Subscription GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', authUser.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { action } = await request.json()

    if (action === 'subscribe') {
      // Check if already subscribed
      const { data: existing } = await svc.from('dd_subscriptions').select('id, status').eq('user_id', ddUser.id).single()

      if (existing && existing.status === 'active') {
        return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30-day trial

      if (existing) {
        // Reactivate
        await svc.from('dd_subscriptions').update({
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          cancelled_at: null,
        }).eq('id', existing.id)
      } else {
        await svc.from('dd_subscriptions').insert({
          user_id: ddUser.id,
          plan: 'pass',
          status: 'active',
          expires_at: expiresAt.toISOString(),
        })
      }

      return NextResponse.json({ success: true, expires_at: expiresAt.toISOString() })
    }

    if (action === 'cancel') {
      const { data: sub } = await svc.from('dd_subscriptions').select('id, status').eq('user_id', ddUser.id).single()
      if (!sub || sub.status !== 'active') {
        return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
      }

      await svc.from('dd_subscriptions').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).eq('id', sub.id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Subscription POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
