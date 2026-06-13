import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/pin-hash'

// PATCH  /api/pos/cashiers/:id   → update name, role, hourly_rate, PIN, status
// DELETE /api/pos/cashiers/:id   → soft-inactive
//
// Soft delete (status='inactive') preserves shift + sale attribution
// history. Hard delete is intentionally NOT exposed — admin can run
// it via SQL if a row was created in error.

async function authorize(staffRowId: string) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }
  // Admin / general / field managers can manage any shop's cashier roster.
  // Marketing manager is excluded — POS staff is operational, not marketing.
  if (
    caller.role === 'admin' ||
    caller.role === 'general_manager' ||
    caller.role === 'field_manager'
  ) {
    return { svc, caller }
  }
  // Shop owner must own the shop the staff row belongs to.
  const { data: staff } = await svc
    .from('dd_shop_staff')
    .select('shop_id')
    .eq('id', staffRowId)
    .maybeSingle()
  if (!staff) return { error: 'Cashier not found', status: 404 as const }
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id')
    .eq('id', staff.shop_id)
    .eq('owner_id', caller.id)
    .maybeSingle()
  if (!shop) return { error: 'You do not own this shop', status: 403 as const }
  return { svc, caller }
}

interface PatchBody {
  name?: string
  role?: 'cashier' | 'manager'
  hourly_rate?: number | null
  status?: 'active' | 'inactive'
  pin?: string
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await authorize(id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const staffPatch: Record<string, unknown> = {}
  if (body.role && ['cashier', 'manager'].includes(body.role)) staffPatch.role = body.role
  if (body.hourly_rate !== undefined) staffPatch.hourly_rate = body.hourly_rate
  if (body.status && ['active', 'inactive'].includes(body.status)) staffPatch.status = body.status
  if (body.pin !== undefined) {
    if (!/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 })
    }
    const { hash, salt } = hashPin(body.pin)
    staffPatch.pin_hash = hash
    staffPatch.pin_salt = salt
    staffPatch.pin_failed_attempts = 0
    staffPatch.pin_locked_until = null
  }

  if (Object.keys(staffPatch).length > 0) {
    const { error } = await a.svc
      .from('dd_shop_staff')
      .update(staffPatch)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Name lives on dd_users (so it's consistent across other surfaces
  // that read dd_users.name).
  if (body.name?.trim()) {
    const { data: staff } = await a.svc
      .from('dd_shop_staff')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()
    if (staff) {
      await a.svc
        .from('dd_users')
        .update({ name: body.name.trim() })
        .eq('id', staff.user_id)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await authorize(id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Soft-inactive — never hard delete from the API. Sale + shift logs
  // need to keep referencing the user_id.
  const { error } = await a.svc
    .from('dd_shop_staff')
    .update({ status: 'inactive' })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
