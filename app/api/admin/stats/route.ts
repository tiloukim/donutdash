import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all stats in parallel
    const [ordersRes, shopsRes, driversRes, usersRes] = await Promise.all([
      svc.from('dd_orders').select('id, total, status'),
      svc.from('dd_shops').select('id, is_active'),
      svc.from('dd_users').select('id').eq('role', 'driver').eq('is_active', true),
      svc.from('dd_users').select('id'),
    ])

    const orders = ordersRes.data || []
    const shops = shopsRes.data || []
    const drivers = driversRes.data || []
    const users = usersRes.data || []

    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0)

    return NextResponse.json({
      totalRevenue,
      totalOrders: orders.length,
      activeShops: shops.filter(s => s.is_active).length,
      activeDrivers: drivers.length,
      totalUsers: users.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
