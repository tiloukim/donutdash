import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      .select('driver_id, is_online, lat, lng, updated_at')
      .in('driver_id', driverIds.length > 0 ? driverIds : ['__none__'])

    const locationMap: Record<string, { is_online: boolean; lat: number; lng: number; updated_at: string }> = {}
    for (const loc of locations || []) {
      locationMap[loc.driver_id] = { is_online: loc.is_online, lat: loc.lat, lng: loc.lng, updated_at: loc.updated_at }
    }

    // Treat is_online as false if the last ping is older than the staleness window —
    // protects the UI/assigner from rows the offline-stale-drivers cron hasn't cleaned up yet.
    const STALE_MS = 2 * 60 * 1000
    const now = Date.now()
    const isFresh = (updatedAt: string | undefined) =>
      !!updatedAt && now - new Date(updatedAt).getTime() < STALE_MS

    const driversWithStats = (drivers || []).map(driver => {
      const loc = locationMap[driver.id]
      const effectivelyOnline = !!loc?.is_online && isFresh(loc?.updated_at)
      return {
        ...driver,
        avatar_url: driver.avatar_url || null,
        deliveryCount: statsMap[driver.id]?.deliveryCount || 0,
        totalEarnings: statsMap[driver.id]?.totalEarnings || 0,
        is_online: effectivelyOnline,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        last_seen: loc?.updated_at || null,
      }
    })

    return NextResponse.json({ drivers: driversWithStats })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — approve/update driver status
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'admin' && ddUser.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { driverId, driver_status } = await req.json()
  if (!driverId || !['pending_documents', 'pending_approval', 'approved'].includes(driver_status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { error } = await svc.from('dd_users').update({ driver_status }).eq('id', driverId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
