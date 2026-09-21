// Which shops have their real books kept in the DonutDash Technologies tax
// workspace, and under which trading entity.
//
// This is a LINK ONLY. No figures move: the shop's bookkeeping page stays
// exactly as it is, and the workspace stays the separate, password-gated
// system it already is. All this does is save a trip through the address bar
// for an owner who works in both.
//
// Deliberately an explicit shop-id list rather than a rule. A shop is in here
// because its owner also keeps books in the workspace and asked for the
// shortcut — that is not something to infer. Every other shop on the platform
// sees nothing, which is the point: most shops are not ours, and their
// bookkeeping page must not sprout a link to somebody else's accounts.
//
// Resolved server-side so only the matching shop's browser is ever told the
// entity exists.

const TAX_WORKSPACE_ORIGIN = 'https://donutdashtech.com'

/** shop id → entity slug in the tax workspace. */
const ENTITY_BY_SHOP: Record<string, string> = {
  // Top Donuts (Tyler, TX) — trades as Kimco LLC.
  '22222222-2222-2222-2222-222222222222': 'kimco-llc',
}

export interface TaxWorkspaceLink {
  /** Entity slug, e.g. 'kimco-llc'. */
  entity: string
  /** Deep link to that entity's books for the year being viewed. */
  url: string
}

/** The workspace link for a shop and year, or null if the shop has none. */
export function taxWorkspaceFor(shopId: string, year: number | string): TaxWorkspaceLink | null {
  const entity = ENTITY_BY_SHOP[shopId]
  if (!entity) return null

  // Year is echoed straight into the path, so it has to be a year and not
  // whatever arrived in the query string.
  const y = String(year)
  if (!/^\d{4}$/.test(y)) return null

  return { entity, url: `${TAX_WORKSPACE_ORIGIN}/tax/${entity}/${y}` }
}
