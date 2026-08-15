import { AVERAGE_SPEED_MPH } from './constants'

// Donuts are pre-made (no cook time), so the fixed part of a delivery is just
// dispatch + bagging + driver pickup — not the made-to-order prep that
// AVERAGE_PREP_TIME_MINUTES models. Everything past that is drive time.
const HANDLING_MIN = 10
// Rounded, honest range shown to customers when we don't know their distance
// (cart before an address is entered, browse pages without geolocation).
export const DEFAULT_ETA_LABEL = '15-30 min'

// Distance-based delivery estimate. Returns a rounded low/high window (minutes)
// and a display label. Close orders read genuinely fast; a 10-mi order is still
// honest at ~35-45.
export function estimateDeliveryEta(distanceMiles: number | null | undefined): { low: number; high: number; label: string } {
  const miles = Math.max(0, distanceMiles ?? 0)
  const driveMin = (miles / AVERAGE_SPEED_MPH) * 60
  const center = HANDLING_MIN + driveMin
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)
  const low = round5(center)
  const high = low + 10
  return { low, high, label: `${low}-${high} min` }
}
