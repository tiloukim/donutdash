import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DRIVER_STALE_MS } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Drivers ping every ~30s while the app is alive (even backgrounded/stationary).
  // DRIVER_STALE_MS tolerates a run of dropped pings / OS throttling so an
  // active-but-idle driver is not wrongly offlined, while still cleaning up
  // genuinely closed or killed apps within a few minutes. The dispatch path
  // uses the same threshold so "online" and "dispatch-eligible" stay in sync.
  const staleBefore = new Date(Date.now() - DRIVER_STALE_MS).toISOString()

  const { data, error } = await svc
    .from('dd_driver_locations')
    .update({ is_online: false })
    .eq('is_online', true)
    .lt('updated_at', staleBefore)
    .select('driver_id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ offlined: data?.length ?? 0 })
}
