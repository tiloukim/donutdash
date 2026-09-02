import { NextResponse } from 'next/server'

// Short link for installing the DonutDash POS Android APK on a register.
//
// Why this exists: EAS artifact URLs look like
//   https://expo.dev/artifacts/eas/5w-OgGj1jhU9tROul1woiUC2c87asJzgIu_3f0HHwHg.apk
// which is unusable on an Elo's on-screen keyboard. `donutdash.app/pos` is
// typeable in a few seconds at the register.
//
// Updating for a new build: set POS_APK_URL in Vercel (Project → Settings →
// Environment Variables) to the new artifact URL and redeploy — no code
// change needed. The fallback below is only a safety net for when the env
// var is missing, and WILL go stale, so prefer the env var.
//
// Get the artifact URL with:
//   npx eas-cli build:view <build-id>      → "Application Archive URL"
//   npx eas-cli build:list --platform android --limit 1
//
// NOTE: this path is public. Anyone who guesses it can download the POS
// APK. That's a low but non-zero exposure — the app is useless without
// staff credentials (every screen sits behind Supabase auth, and the
// server re-checks shop ownership on each request), but it does hand out
// our client bundle. If that matters, gate it behind a query token or
// move it to an unguessable path.

const FALLBACK_APK_URL =
  'https://expo.dev/artifacts/eas/5w-OgGj1jhU9tROul1woiUC2c87asJzgIu_3f0HHwHg.apk'

export const dynamic = 'force-dynamic'

export function GET() {
  const target = process.env.POS_APK_URL || FALLBACK_APK_URL
  // 302, not 301 — the target changes with every build, and a permanent
  // redirect would get cached by the register's browser and keep serving
  // the old APK after we point this at a new one.
  return NextResponse.redirect(target, 302)
}
