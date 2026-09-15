import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-auth'

// Admin management of POS app releases.
//
//   GET    list every recorded build, newest first
//   POST   record a build (is_released defaults false — recording is not
//          releasing)
//   PATCH  flip is_released
//
// Admin-only, not manager. Releasing a build sends it to every register that
// checks in, and an install replaces the running app — there is no lighter
// way to describe that than "the most consequential button in the admin".
// Nothing here is reachable by a general/field/marketing manager.

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || !isAdmin(ddUser.role)) return { error: 'Forbidden', status: 403 as const }
  return { svc }
}

export async function GET() {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data, error } = await a.svc
    .from('dd_app_releases')
    .select('*')
    .order('build_number', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ releases: data ?? [] })
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const body = await req.json().catch(() => null) as
    | { build_number?: number; version?: string; apk_url?: string; notes?: string }
    | null
  if (!body?.build_number || !body.version || !body.apk_url) {
    return NextResponse.json({ error: 'build_number, version and apk_url are required' }, { status: 400 })
  }
  if (!Number.isInteger(body.build_number) || body.build_number <= 0) {
    return NextResponse.json({ error: 'build_number must be a positive integer' }, { status: 400 })
  }
  // The device downloads and installs whatever this points at, so it must be
  // somewhere we control. An arbitrary URL here would turn a compromised admin
  // session into arbitrary software on every till — Android's signature check
  // would still reject it, but there is no reason to rely on that alone.
  if (!/^https:\/\/expo\.dev\/artifacts\//.test(body.apk_url)) {
    return NextResponse.json(
      { error: 'apk_url must be an https://expo.dev/artifacts/ link' },
      { status: 400 },
    )
  }

  const { data, error } = await a.svc
    .from('dd_app_releases')
    .insert({
      build_number: body.build_number,
      version: body.version,
      apk_url: body.apk_url,
      notes: body.notes ?? null,
      // Recorded, not released. Releasing is a second, deliberate action.
      is_released: false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ release: data })
}

export async function PATCH(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const body = await req.json().catch(() => null) as
    | { build_number?: number; is_released?: boolean }
    | null
  if (!body?.build_number || typeof body.is_released !== 'boolean') {
    return NextResponse.json({ error: 'build_number and is_released are required' }, { status: 400 })
  }

  const { data, error } = await a.svc
    .from('dd_app_releases')
    .update({
      is_released: body.is_released,
      released_at: body.is_released ? new Date().toISOString() : null,
    })
    .eq('build_number', body.build_number)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Un-releasing is the halt switch: devices that haven't checked in yet stop
  // being offered the build. It does not uninstall it from anything that
  // already took it — recovery from a bad build that reached a register is
  // still a newer build, or a USB stick.
  return NextResponse.json({ release: data })
}
