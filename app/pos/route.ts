import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Short link for installing the DonutDash POS Android APK on a register.
//
// Why this exists: EAS artifact URLs look like
//   https://expo.dev/artifacts/eas/5w-OgGj1jhU9tROul1woiUC2c87asJzgIu_3f0HHwHg.apk
// which is unusable on an Elo's on-screen keyboard. `donutdash.app/pos` is
// typeable in a few seconds at the register.
//
// ── Where the answer comes from, and why it changed ──────────────────────
//
// This used to read POS_APK_URL from the environment, with a hardcoded
// fallback "only a safety net". The env var was never set. So for months the
// safety net WAS the answer, and it pointed at a build old enough that it
// predates the releases table entirely — anyone setting up a register from
// this link got that. Nothing failed, nothing warned; the link just quietly
// handed out the wrong app.
//
// The lesson is not "remember to update the env var". It is that a release
// step with two places to update has one place that gets forgotten. So the
// link now reads the releases table, which is already the record of what is
// shipped: marking a build released in dd_app_releases IS repointing this
// link. One control, no second step, nothing to keep in sync.
//
// To pin the fleet to an older build, un-release the newer rows. That is
// visible in the table and in /admin, unlike an env var nobody can see.
//
// POS_APK_URL survives only as an emergency override for when the database
// is unreachable. It is deliberately NOT consulted first — an override that
// wins by default is how this broke in the first place.
//
// NOTE: this path is public. Anyone who guesses it can download the POS
// APK. That's a low but non-zero exposure — the app is useless without
// staff credentials (every screen sits behind Supabase auth, and the
// server re-checks shop ownership on each request), but it does hand out
// our client bundle. If that matters, gate it behind a query token or
// move it to an unguessable path.

export const dynamic = 'force-dynamic'

export async function GET() {
  let target: string | null = null

  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('dd_app_releases')
      .select('apk_url, build_number')
      .eq('is_released', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.apk_url) target = data.apk_url
  } catch (e) {
    console.error('[pos] release lookup failed', e)
  }

  // Only when the table could not answer.
  if (!target && process.env.POS_APK_URL) {
    console.warn('[pos] falling back to POS_APK_URL — releases table unavailable')
    target = process.env.POS_APK_URL
  }

  if (!target) {
    // Deliberately an error, not a stale redirect. Handing someone an APK we
    // cannot confirm is current is what this route spent months doing, and a
    // technician who is told to try again will do that; one who silently
    // installs a two-year-old build will not know for weeks.
    return new NextResponse(
      'Could not determine the current POS build. Try again in a moment, or ask DonutDash for the APK link.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }

  // 302, not 301 — the target changes with every release, and a permanent
  // redirect would get cached by the register's browser and keep serving the
  // old APK after a new one is out.
  return NextResponse.redirect(target, 302)
}
