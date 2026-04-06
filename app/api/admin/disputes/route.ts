import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: disputes, error } = await svc
      .from('dd_disputes')
      .select(`
        *,
        customer:dd_users!customer_id(id, name, email),
        order:dd_orders!order_id(id, total, status, created_at, shop_id, shop:dd_shops!shop_id(name)),
        resolver:dd_users!resolved_by(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ disputes: disputes || [] })
  } catch (err) {
    console.error('[ADMIN DISPUTES] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { dispute_id, status, admin_notes } = body

    if (!dispute_id) return NextResponse.json({ error: 'dispute_id required' }, { status: 400 })
    if (!status || !['approved', 'rejected', 'refunded'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be approved, rejected, or refunded.' }, { status: 400 })
    }

    const { data: dispute, error } = await svc
      .from('dd_disputes')
      .update({
        status,
        admin_notes: admin_notes?.trim() || null,
        resolved_at: new Date().toISOString(),
        resolved_by: ddUser.id,
      })
      .eq('id', dispute_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, dispute })
  } catch (err) {
    console.error('[ADMIN DISPUTES] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
