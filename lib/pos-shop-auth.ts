import { createClient, createServiceClient } from '@/lib/supabase/server'

// Shared "is this caller allowed to act on this shop" check for the POS
// routes (Netevia payments, orders, etc.). Beyond identity + ownership it
// enforces ACCOUNT STATE, so deactivating a shop or owner in the admin web
// actually stops the POS:
//   - caller is_active   → a deactivated login can't act at all
//   - shop  is_active    → a deactivated shop's POS is blocked
//   - shop  pos_enabled  → POS sold as a separate entitlement from delivery
//
// Privileged staff (admin/managers) bypass the SHOP-status gate so they can
// still configure or support a shop that is currently off.
//
// Returns either { svc, caller } on success, or { error, status } that the
// route can hand straight to NextResponse.json.

interface AuthorizeOpts {
  // Roles allowed to act on any shop (not just one they own). Default lines
  // up with terminal-credentials: admin + the two manager tiers. Drop to
  // ['admin'] for sensitive financial routes.
  privilegedRoles?: string[]
}

const DEFAULT_PRIVILEGED = ['admin', 'general_manager', 'field_manager']

interface OwnedShopStatus {
  id: string
  is_active: boolean | null
  pos_enabled?: boolean | null
}

// Fetch the owner's shop with its status flags. Tolerates the pos_enabled
// column not being migrated yet — if the column is absent the first select
// errors, and we fall back to a select without it (POS treated as enabled
// until the migration runs), so deploying this code before the SQL can't
// lock everyone out.
async function fetchOwnedShopStatus(
  svc: ReturnType<typeof createServiceClient>,
  shopId: string,
  ownerId: string,
): Promise<OwnedShopStatus | null> {
  const full = await svc
    .from('dd_shops')
    .select('id, is_active, pos_enabled')
    .eq('id', shopId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (!full.error) return (full.data as OwnedShopStatus) ?? null

  const basic = await svc
    .from('dd_shops')
    .select('id, is_active')
    .eq('id', shopId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return (basic.data as OwnedShopStatus) ?? null
}

export async function authorizeForShop(shopId: string, opts: AuthorizeOpts = {}) {
  const privileged = opts.privilegedRoles ?? DEFAULT_PRIVILEGED

  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role, is_active')
    .eq('auth_id', user.id)
    .single()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }

  // A deactivated account cannot act on the POS, whatever its role.
  if (caller.is_active === false) {
    return { error: 'Your account has been deactivated. Please contact DonutDash.', status: 403 as const }
  }

  if (!privileged.includes(caller.role)) {
    const shop = await fetchOwnedShopStatus(svc, shopId, caller.id)
    if (!shop) return { error: 'You do not own this shop', status: 403 as const }
    if (shop.is_active === false) {
      return { error: 'This shop has been deactivated. Please contact DonutDash.', status: 403 as const }
    }
    if (shop.pos_enabled === false) {
      return { error: 'POS access is disabled for this shop. Please contact DonutDash.', status: 403 as const }
    }
  }
  return { svc, caller }
}

export type AuthorizedShopContext = Awaited<ReturnType<typeof authorizeForShop>>
