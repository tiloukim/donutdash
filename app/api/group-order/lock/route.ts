import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST: Lock the group order (host only)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: dbUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { group_order_id } = await req.json()
    if (!group_order_id) {
      return NextResponse.json({ error: 'group_order_id is required' }, { status: 400 })
    }

    // Get group order and verify host
    const { data: groupOrder } = await svc
      .from('dd_group_orders')
      .select('*')
      .eq('id', group_order_id)
      .single()

    if (!groupOrder) {
      return NextResponse.json({ error: 'Group order not found' }, { status: 404 })
    }

    if (groupOrder.host_id !== dbUser.id) {
      return NextResponse.json({ error: 'Only the host can lock the group order' }, { status: 403 })
    }

    if (groupOrder.status !== 'open') {
      return NextResponse.json({ error: 'Group order is already locked' }, { status: 400 })
    }

    const { error } = await svc
      .from('dd_group_orders')
      .update({ status: 'locked' })
      .eq('id', group_order_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to lock group order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: 'locked' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
