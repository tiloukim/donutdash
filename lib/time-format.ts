/**
 * Human-readable times in a shop's own timezone.
 *
 * Vercel functions run in UTC. Every server-side `toLocaleString()` without an
 * explicit `timeZone` therefore rendered UTC, which is never what a shop or a
 * customer means: a 12:30 UTC pickup slot went out by SMS as "Sep 12, 12:30 PM"
 * when everyone involved meant 7:30 AM Central.
 *
 * Always pass the shop's timezone. DEFAULT_SHOP_TIMEZONE is a fallback for rows
 * written before dd_shops.timezone existed, not a licence to skip it.
 */
export const DEFAULT_SHOP_TIMEZONE = 'America/Chicago'

/** "Sep 12, 7:30 AM" in the shop's timezone. */
export function formatShopDateTime(
  iso: string | Date,
  timeZone: string | null | undefined,
): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    timeZone: timeZone || DEFAULT_SHOP_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
