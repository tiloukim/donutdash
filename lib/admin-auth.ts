// Platform-wide role checking helpers for the admin portal.
//
// The platform identity roles (dd_users.role) split managers into:
//   - general_manager  : broad operational access, no Tax/Settings/Claim Requests
//   - field_manager    : ops focus — drivers, shops, orders, support, dispatch
//   - marketing_manager: growth focus — flyers, menu templates, team cards, campaigns
//   - admin            : everything
//
// Per-page visibility is encoded in PAGE_ROLES below and consumed by
// the admin layout. Add a new page → add one entry here.

export type PlatformRole =
  | 'customer'
  | 'shop_owner'
  | 'driver'
  | 'admin'
  | 'general_manager'
  | 'field_manager'
  | 'marketing_manager'
  | 'cashier'

export type ManagerRole =
  | 'general_manager'
  | 'field_manager'
  | 'marketing_manager'

export type AdminPortalRole = 'admin' | ManagerRole

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function isAnyManager(role: string | null | undefined): boolean {
  return (
    role === 'general_manager' ||
    role === 'field_manager' ||
    role === 'marketing_manager'
  )
}

// True if the role can sign in to /admin at all. Use as the gate
// before any per-page filtering.
export function canAccessAdminPortal(
  role: string | null | undefined,
): role is AdminPortalRole {
  return isAdmin(role) || isAnyManager(role)
}

// Per-page role matrix. Key = admin route path, value = roles that
// can see it in the sidebar (and, if we add page-level guards,
// access it directly).
//
// Confirmed access matrix (2026-06-13):
//   General  ≈ everything except Tax / Settings / Claim Requests
//   Field    = ops surface (shops, drivers, orders, support, ivr, disputes…)
//   Marketing= growth surface (flyers, menu templates, team cards, campaigns)
//   Admin    = everything
export const PAGE_ROLES: Record<string, readonly AdminPortalRole[]> = {
  '/admin':                  ['admin', 'general_manager', 'field_manager', 'marketing_manager'],
  '/admin/shops':            ['admin', 'general_manager', 'field_manager', 'marketing_manager'],
  '/admin/users':            ['admin', 'general_manager'],
  '/admin/orders':           ['admin', 'general_manager', 'field_manager'],
  '/admin/drivers':          ['admin', 'general_manager', 'field_manager'],
  '/admin/driver-documents': ['admin', 'general_manager', 'field_manager'],
  '/admin/shop-documents':   ['admin', 'general_manager', 'field_manager'],
  '/admin/claim-requests':   ['admin'],
  '/admin/payouts':          ['admin', 'general_manager'],
  '/admin/catering':         ['admin', 'general_manager', 'field_manager'],
  '/admin/support':          ['admin', 'general_manager', 'field_manager'],
  '/admin/voicemails':       ['admin', 'general_manager', 'field_manager'],
  '/admin/ivr':              ['admin', 'general_manager'],
  '/admin/ivr-extensions':   ['admin', 'general_manager'],
  '/admin/disputes':         ['admin', 'general_manager', 'field_manager'],
  '/admin/flyers':           ['admin', 'general_manager', 'marketing_manager'],
  '/admin/menu-templates':   ['admin', 'general_manager', 'marketing_manager'],
  '/admin/team':             ['admin', 'general_manager', 'marketing_manager'],
  '/admin/analytics':        ['admin', 'general_manager', 'field_manager', 'marketing_manager'],
  '/admin/pitch-campaign':   ['admin', 'general_manager', 'field_manager', 'marketing_manager'],
  '/admin/access-matrix':    ['admin'],
  '/admin/tax':              ['admin'],
  '/admin/settings':         ['admin'],
}

// Friendly metadata for each admin page — used by the sidebar and
// the access matrix visualizer. Group is used to cluster rows in the
// matrix view (Operations, Marketing, Admin-only). Order matters:
// matches the sidebar's display order.
export const ADMIN_PAGE_META: Record<
  keyof typeof PAGE_ROLES,
  { label: string; icon: string; group: 'overview' | 'ops' | 'marketing' | 'admin' }
> = {
  '/admin':                  { label: 'Dashboard',      icon: '📊', group: 'overview' },
  '/admin/shops':            { label: 'Shops',          icon: '🏪', group: 'ops' },
  '/admin/users':            { label: 'Users',          icon: '👥', group: 'ops' },
  '/admin/orders':           { label: 'Orders',         icon: '📦', group: 'ops' },
  '/admin/drivers':          { label: 'Drivers',        icon: '🚗', group: 'ops' },
  '/admin/driver-documents': { label: 'Driver Docs',    icon: '📋', group: 'ops' },
  '/admin/shop-documents':   { label: 'Shop Docs',      icon: '📑', group: 'ops' },
  '/admin/catering':         { label: 'Catering',       icon: '🎂', group: 'ops' },
  '/admin/support':          { label: 'Support Chat',   icon: '💬', group: 'ops' },
  '/admin/voicemails':       { label: 'Voicemails',     icon: '📞', group: 'ops' },
  '/admin/ivr':              { label: 'IVR Settings',   icon: '☎️', group: 'ops' },
  '/admin/ivr-extensions':   { label: 'IVR Extensions', icon: '🔢', group: 'ops' },
  '/admin/disputes':         { label: 'Disputes',       icon: '⚠️', group: 'ops' },
  '/admin/payouts':          { label: 'Payouts',        icon: '💰', group: 'ops' },
  '/admin/flyers':           { label: 'Shop Flyers',    icon: '📄', group: 'marketing' },
  '/admin/menu-templates':   { label: 'Menu Templates', icon: '🍩', group: 'marketing' },
  '/admin/team':             { label: 'Team Cards',     icon: '🪪', group: 'marketing' },
  '/admin/analytics':        { label: 'Live Analytics', icon: '📈', group: 'marketing' },
  '/admin/pitch-campaign':   { label: 'Pitch Campaign', icon: '📣', group: 'marketing' },
  '/admin/access-matrix':    { label: 'Role Access',    icon: '🎨', group: 'admin' },
  '/admin/claim-requests':   { label: 'Claim Requests', icon: '🏷️', group: 'admin' },
  '/admin/tax':              { label: 'Tax Center',     icon: '🧾', group: 'admin' },
  '/admin/settings':         { label: 'Settings',       icon: '⚙️', group: 'admin' },
}

// Pick the most specific PAGE_ROLES key that matches a pathname.
// /admin/drivers/abc/edit -> /admin/drivers
// /admin/menu-templates/x -> /admin/menu-templates (not /admin)
// Returns null if no key matches.
export function matchAdminSection(path: string): keyof typeof PAGE_ROLES | null {
  // Longest key first so /admin/menu-templates beats /admin.
  const keys = Object.keys(PAGE_ROLES).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (path === key || path.startsWith(key + '/')) return key
  }
  return null
}

export function canAccessAdminPage(
  role: string | null | undefined,
  path: string,
): boolean {
  if (!canAccessAdminPortal(role)) return false
  const section = matchAdminSection(path)
  if (!section) return isAdmin(role) // unknown route — admin-only by default
  return PAGE_ROLES[section].includes(role as AdminPortalRole)
}

// Display metadata for the sidebar badge.
export const ROLE_BADGES: Record<AdminPortalRole, { label: string; color: string }> = {
  admin:              { label: 'ADMIN',     color: '#6366F1' },
  general_manager:    { label: 'GENERAL',   color: '#FF8C00' },
  field_manager:      { label: 'FIELD',     color: '#0EA5E9' },
  marketing_manager:  { label: 'MARKETING', color: '#EC4899' },
}

// Pages that must always be reachable by every admin portal user
// — lockout safety. If someone unchecks /admin (Dashboard) the user
// would have no landing page on sign-in.
export const ALWAYS_ALLOWED_PAGES: readonly string[] = [
  '/admin',
]

// Pages hard-locked to admin only — non-overridable by the DB matrix.
// Role Access edits everyone's permissions, so a non-admin must never be
// able to reach it (they could otherwise grant themselves any page).
export const ADMIN_ONLY_PAGES: readonly string[] = [
  '/admin/access-matrix',
]

// Apply the "admin sees everything + locked pages always allowed" rules
// on top of whatever the DB matrix says. Use this everywhere effective
// permissions are computed.
export function applyPermissionGuards(
  matrix: Record<string, readonly AdminPortalRole[]>,
): Record<string, readonly AdminPortalRole[]> {
  const out: Record<string, readonly AdminPortalRole[]> = {}
  for (const path of Object.keys(matrix)) {
    // Hard-locked pages are admin-only, ignoring whatever the DB matrix says.
    if (ADMIN_ONLY_PAGES.includes(path)) {
      out[path] = ['admin']
      continue
    }
    const set = new Set<AdminPortalRole>(matrix[path])
    set.add('admin') // admin is never absent
    if (ALWAYS_ALLOWED_PAGES.includes(path)) {
      set.add('general_manager')
      set.add('field_manager')
      set.add('marketing_manager')
    }
    out[path] = Array.from(set)
  }
  return out
}
