import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-auth'

// GET /api/admin/square-status
//
// What this project's Square credentials actually resolve to.
//
// Square has two independent axes that both fail the same silent way: the
// environment (production vs sandbox) and the seller account the token
// belongs to. Get either wrong and the API answers plausibly — an empty
// list, a "location not found" — with nothing naming the real problem. Two
// full days of this project's Square work went into diagnosing exactly that
// by changing one variable at a time and reading the tea leaves.
//
// So this asks Square directly: which locations can this token see, and is
// the one we are configured to use among them. A yes/no that takes a second
// beats another round of guesswork.
//
// NEVER returns the access token, in full or in part. The application id is
// a public identifier and is shown, because knowing WHICH app is configured
// is most of the answer when two Square accounts are in play.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface SquareLocation {
  id?: string
  name?: string
  status?: string
  address?: { locality?: string }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { data: me } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!me || !isAdmin(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.SQUARE_ACCESS_TOKEN
  const configuredLocation = process.env.SQUARE_LOCATION_ID ?? null
  const appId = process.env.SQUARE_APP_ID ?? null
  const envVar = process.env.SQUARE_ENVIRONMENT ?? null

  // Mirrors client() in lib/square-sales.ts EXACTLY, including its default.
  // That default is production-only-when-named, so an unset variable means
  // sandbox — the opposite of what the tax workspace's client does with the
  // same variable name. Reporting the resolved value rather than the raw one
  // is the point: the raw value does not tell you which way it fell.
  const resolved = envVar === 'production' ? 'production' : 'sandbox'

  const base = resolved === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

  const report: Record<string, unknown> = {
    environment: {
      SQUARE_ENVIRONMENT: envVar,
      resolvedTo: resolved,
      note: resolved === 'sandbox' && envVar !== 'sandbox'
        ? 'SQUARE_ENVIRONMENT is not set to "production", so this project falls back to SANDBOX. Production credentials and location ids will not work.'
        : undefined,
    },
    applicationId: appId,
    accessToken: token ? 'set' : 'MISSING',
    configuredLocationId: configuredLocation,
  }

  if (!token) {
    return NextResponse.json({ ...report, verdict: 'SQUARE_ACCESS_TOKEN is not set.' })
  }

  try {
    const res = await fetch(`${base}/v2/locations`, {
      headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2025-01-23' },
      cache: 'no-store',
    })
    const body = await res.json().catch(() => ({})) as {
      locations?: SquareLocation[]
      errors?: { detail?: string; code?: string }[]
    }

    if (!res.ok) {
      return NextResponse.json({
        ...report,
        verdict: `Square rejected the token (${res.status}): ${body.errors?.[0]?.detail ?? 'no detail'}`,
        likelyCause: res.status === 401
          ? `The token does not belong to the ${resolved} environment, or has been replaced.`
          : undefined,
      })
    }

    const locations = (body.locations ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      city: l.address?.locality,
      isConfiguredOne: l.id === configuredLocation,
    }))
    const match = locations.find((l) => l.isConfiguredOne)

    return NextResponse.json({
      ...report,
      // The whole question, answered: these are the locations this token can
      // see. A location from another Square account will never appear here,
      // however correct it looks when copied from a dashboard.
      locationsThisTokenCanSee: locations,
      verdict: !configuredLocation
        ? 'SQUARE_LOCATION_ID is not set.'
        : match
          ? `OK — configured location "${match.name}" is visible to this token in ${resolved}.`
          : `MISMATCH — SQUARE_LOCATION_ID (${configuredLocation}) is not one of the locations this token can see. It belongs to a different Square account, or to the other environment.`,
    })
  } catch (e) {
    return NextResponse.json({
      ...report,
      verdict: `Could not reach Square: ${e instanceof Error ? e.message : String(e)}`,
    })
  }
}
