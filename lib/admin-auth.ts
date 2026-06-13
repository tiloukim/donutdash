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
  '/admin/tax':              ['admin'],
  '/admin/settings':         ['admin'],
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
