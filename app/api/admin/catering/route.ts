import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    if (!ddUser || ddUser.role !== 'admin') {
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

    if (!ddUser || ddUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, status, quote_amount, admin_notes } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (quote_amount !== undefined) updates.quote_amount = quote_amount
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
