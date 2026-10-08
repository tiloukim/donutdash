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
  /**
   * Skip the POS kill-switch for this route.
   *
   * For the handful of endpoints that are not sales: heartbeat, build checks,
   * device commands. A disabled register should stop taking money, which is
   * what the switch is for — but it should not also go dark and become
   * unreachable and un-updatable, because then the only way to recover it is
   * physically. Telemetry and updates keep working; takings do not.
   */
  allowPosDisabled?: boolean
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
  }

  // The POS kill-switch applies to EVERYONE, privileged roles included.
  //
  // It used to sit inside the block above, so admin, general_manager and
  // field_manager skipped it entirely along with the ownership and is_active
  // checks. Skipping ownership is right — an admin does not own the shop they
  // are helping — but a kill-switch that exempts the people most likely to be
  // holding the register is not a kill-switch. Disabling POS for Top Donuts
  // did nothing visible because the till was signed in as an admin, and the
  // only way to find that out was to read this function.
  //
  // Checked by shop id rather than by ownership, since a privileged caller
  // has none. This cannot lock anyone out of fixing it: the admin web uses
  // its own auth, not this, so the switch can always be turned back on.
  const status = opts.allowPosDisabled ? null : await fetchShopStatusById(svc, shopId)
  if (status?.pos_enabled === false) {
    return { error: 'POS access is disabled for this shop. Please contact DonutDash.', status: 403 as const }
  }

  return { svc, caller }
}

interface ShopStatus {
  is_active: boolean | null
  pos_enabled?: boolean | null
}

// By-id shop status (no owner filter), tolerant of pos_enabled not being
// migrated yet — treats POS as enabled until the column exists.
async function fetchShopStatusById(
  svc: ReturnType<typeof createServiceClient>,
  shopId: string,
): Promise<ShopStatus | null> {
  const full = await svc.from('dd_shops').select('is_active, pos_enabled').eq('id', shopId).maybeSingle()
  if (!full.error) return (full.data as ShopStatus) ?? null
  const basic = await svc.from('dd_shops').select('is_active').eq('id', shopId).maybeSingle()
  return (basic.data as ShopStatus) ?? null
}

// Shop-only status gate (no caller/role logic) for POS routes that have
// already done their own identity + ownership auth — use when a caller id
// isn't readily available (e.g. lock-screen PIN routes). Returns { error,
// status } to block a deactivated / POS-disabled shop, or null to proceed.
export async function assertShopActive(
  svc: ReturnType<typeof createServiceClient>,
  shopId: string,
): Promise<{ error: string; status: 403 } | null> {
  const shop = await fetchShopStatusById(svc, shopId)
  if (shop?.is_active === false) {
    return { error: 'This shop has been deactivated. Please contact DonutDash.', status: 403 as const }
  }
  if (shop?.pos_enabled === false) {
    return { error: 'POS access is disabled for this shop. Please contact DonutDash.', status: 403 as const }
  }
  return null
}

// Full additive POS gate for routes that already authed the caller. Blocks a
// deactivated caller (any role), and — for non-privileged callers — a
// deactivated / POS-disabled shop. Privileged staff (admin/managers) bypass
// the shop gate so they can still configure/support an off shop. Drop this in
// right after a route's existing auth + shopId resolution; it's purely
// additive (no change to identity/ownership behavior).
export async function assertPosAccess(
  svc: ReturnType<typeof createServiceClient>,
  callerId: string,
  shopId: string,
): Promise<{ error: string; status: 403 } | null> {
  const { data: caller } = await svc
    .from('dd_users')
    .select('role, is_active')
    .eq('id', callerId)
    .maybeSingle()
  if (caller?.is_active === false) {
    return { error: 'Your account has been deactivated. Please contact DonutDash.', status: 403 as const }
  }
  if (caller && DEFAULT_PRIVILEGED.includes(caller.role)) return null
  return assertShopActive(svc, shopId)
}

export type AuthorizedShopContext = Awaited<ReturnType<typeof authorizeForShop>>
