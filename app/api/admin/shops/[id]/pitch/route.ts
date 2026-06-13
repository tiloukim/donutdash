import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { buildPitchForShopId } from '@/lib/pitch'

// GET /api/admin/shops/:id/pitch
// Admin / manager only. Returns the merged pitch aggregate produced by
// the shared lib/pitch helper.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || (!canAccessAdminPortal(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: shopId } = await params
  const pitch = await buildPitchForShopId(shopId)
  if (!pitch) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }
  return NextResponse.json(pitch)
}
