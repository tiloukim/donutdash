import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser || !canAccessAdminPortal(ddUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await svc
      .from('dd_catering_requests')
      .select('*, shop:dd_shops(id, name, slug), customer:dd_users(id, name, email, phone)')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser || !canAccessAdminPortal(ddUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, status, quote_amount, admin_notes } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    // Whitelist statuses so a caller can't set status='deleted' or any
    // arbitrary string. Same intent as how dispute statuses are validated.
    const ALLOWED_STATUSES = new Set(['pending', 'quoted', 'accepted', 'rejected', 'completed', 'cancelled'])
    if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
    }
    // quote_amount must be a non-negative number — without this a negative
    // quote could be stored and later refunded as a positive amount.
    let quoteValue: number | undefined
    if (quote_amount !== undefined && quote_amount !== null) {
      quoteValue = Number(quote_amount)
      if (!Number.isFinite(quoteValue) || quoteValue < 0) {
        return NextResponse.json({ error: 'quote_amount must be a non-negative number' }, { status: 400 })
      }
    }

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (quoteValue !== undefined) updates.quote_amount = quoteValue
    if (admin_notes !== undefined) updates.admin_notes = admin_notes

    const { data, error } = await svc
      .from('dd_catering_requests')
      .update(updates)
      .eq('id', id)
      .select('*, shop:dd_shops(id, name, slug), customer:dd_users(id, name, email, phone)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
