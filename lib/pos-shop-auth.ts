import { createClient, createServiceClient } from '@/lib/supabase/server'

// Shared "is this caller allowed to act on this shop" check for the
// Netevia payment routes. Mirrors the inlined version in
// /api/pos/terminal-credentials and /api/pos/orders — extracted because
// we now have five payment routes that all need the same gate.
//
// Returns either { svc, caller } on success, or { error, status } that
// the route can hand straight to NextResponse.json.

interface AuthorizeOpts {
  // Roles that are allowed to act on any shop (not just one they own).
  // Default lines up with terminal-credentials: admin + the two manager
  // tiers. Drop down to ['admin'] for sensitive financial routes.
  privilegedRoles?: string[]
}

const DEFAULT_PRIVILEGED = ['admin', 'general_manager', 'field_manager']

export async function authorizeForShop(shopId: string, opts: AuthorizeOpts = {}) {
  const privileged = opts.privilegedRoles ?? DEFAULT_PRIVILEGED

  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }

  if (!privileged.includes(caller.role)) {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', shopId)
      .eq('owner_id', caller.id)
      .maybeSingle()
    if (!shop) return { error: 'You do not own this shop', status: 403 as const }
  }
  return { svc, caller }
}

export type AuthorizedShopContext = Awaited<ReturnType<typeof authorizeForShop>>
