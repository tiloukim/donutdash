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

    // Get all drivers
    const { data: drivers, error } = await svc
      .from('dd_users')
      .select('*')
      .eq('role', 'driver')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get delivery stats for each driver
    const driverIds = (drivers || []).map(d => d.id)
    const { data: deliveries } = await svc
      .from('dd_deliveries')
      .select('driver_id, status, driver_earnings')
      .in('driver_id', driverIds.length > 0 ? driverIds : ['__none__'])

    // Aggregate stats
    const statsMap: Record<string, { deliveryCount: number; totalEarnings: number }> = {}
    for (const d of deliveries || []) {
      if (!statsMap[d.driver_id]) {
        statsMap[d.driver_id] = { deliveryCount: 0, totalEarnings: 0 }
      }
      if (d.status === 'delivered') {
        statsMap[d.driver_id].deliveryCount++
        statsMap[d.driver_id].totalEarnings += d.driver_earnings || 0
      }
    }

    // Get online status from driver locations
    const { data: locations } = await svc
      .from('dd_driver_locations')
      .select('driver_id, is_online, updated_at')
      .in('driver_id', driverIds.length > 0 ? driverIds : ['__none__'])

    const locationMap: Record<string, { is_online: boolean; updated_at: string }> = {}
    for (const loc of locations || []) {
      locationMap[loc.driver_id] = { is_online: loc.is_online, updated_at: loc.updated_at }
    }

    const driversWithStats = (drivers || []).map(driver => ({
      ...driver,
      deliveryCount: statsMap[driver.id]?.deliveryCount || 0,
      totalEarnings: statsMap[driver.id]?.totalEarnings || 0,
      is_online: locationMap[driver.id]?.is_online || false,
      last_seen: locationMap[driver.id]?.updated_at || null,
    }))

    return NextResponse.json({ drivers: driversWithStats })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
