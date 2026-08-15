// Runtime pay / fee configuration. Reads dd_platform_settings written
// by /admin/settings; falls back to the constants in lib/constants.ts
// when a row is missing or the read fails.
//
// All values in this object are the SAME number you see in the admin
// Settings UI — driverBasePay is dollars, serviceFeeRate is a fraction
// (0.10 = 10%), shopCommissionRate is a fraction.
//
// New deliveries snapshot driverBasePay onto the row so historical
// reports and weekly payouts always pay what was quoted at the time.

import { cache } from 'react'
import { createServiceClient } from './supabase/server'
import {
  BASE_DELIVERY_PAY,
  BASE_DELIVERY_RADIUS_MILES,
  DEFAULT_DELIVERY_FEE,
  MIN_ORDER_AMOUNT,
  PER_EXTRA_MILE_FEE,
  PER_MILE_PAY,
  SERVICE_FEE_RATE,
  SHOP_COMMISSION_RATE,
} from './constants'

export interface PayConfig {
  driverBasePay: number       // $ per delivery
  driverPerMile: number       // $ per mile (one-way)
  serviceFeeRate: number      // fraction, e.g. 0.10
  defaultDeliveryFee: number  // $ (base fee, covers the free radius)
  deliveryFreeMiles: number   // miles included in the base delivery fee
  deliveryPerExtraMile: number // $ charged per mile beyond the free radius
  shopCommissionRate: number  // fraction, e.g. 0.20
  minOrderAmount: number      // $
}

export const FALLBACK_PAY_CONFIG: PayConfig = {
  driverBasePay:        BASE_DELIVERY_PAY,
  driverPerMile:        PER_MILE_PAY,
  serviceFeeRate:       SERVICE_FEE_RATE,
  defaultDeliveryFee:   DEFAULT_DELIVERY_FEE,
  deliveryFreeMiles:    BASE_DELIVERY_RADIUS_MILES,
  deliveryPerExtraMile: PER_EXTRA_MILE_FEE,
  shopCommissionRate:   SHOP_COMMISSION_RATE,
  minOrderAmount:       MIN_ORDER_AMOUNT,
}

// Convert the (key, value) string rows from dd_platform_settings into
// a typed PayConfig. Unset / NaN / negative values fall back to the
// constant so a malformed row can't pay drivers $0 or charge $-10.
function rowsToConfig(rows: { key: string; value: string }[]): PayConfig {
  const map = new Map(rows.map(r => [r.key, r.value]))
  const num = (k: string, fallback: number, scale = 1): number => {
    const raw = map.get(k)
    if (raw == null || raw === '') return fallback
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return fallback
    return n * scale
  }
  // Settings page stores fee/commission as whole-number percent ("10", "20").
  // Constants are fractions ("0.10", "0.20"). Convert on read.
  return {
    driverBasePay:        num('driver_base_pay',       BASE_DELIVERY_PAY),
    driverPerMile:        num('driver_per_mile',       PER_MILE_PAY),
    serviceFeeRate:       num('service_fee_rate',      SERVICE_FEE_RATE * 100) / 100,
    defaultDeliveryFee:   num('default_delivery_fee',  DEFAULT_DELIVERY_FEE),
    deliveryFreeMiles:    num('delivery_free_miles',   BASE_DELIVERY_RADIUS_MILES),
    deliveryPerExtraMile: num('delivery_per_extra_mile', PER_EXTRA_MILE_FEE),
    shopCommissionRate:   num('shop_commission_rate',  SHOP_COMMISSION_RATE * 100) / 100,
    minOrderAmount:       num('min_order_amount',      MIN_ORDER_AMOUNT),
  }
}

// React.cache memoizes per request — multiple awaiters within the same
// request share one DB read instead of round-tripping for each.
export const getPayConfig = cache(async (): Promise<PayConfig> => {
  try {
    const svc = createServiceClient()
    const { data, error } = await svc
      .from('dd_platform_settings')
      .select('key, value')
    if (error || !data) return FALLBACK_PAY_CONFIG
    return rowsToConfig(data)
  } catch {
    return FALLBACK_PAY_CONFIG
  }
})

// Quote driver earnings using the live config — for new offers / new
// deliveries. Historical computations should use the row's snapshotted
// base_pay, not this helper.
export async function quoteDriverEarnings(
  distanceMiles: number,
  tip = 0,
): Promise<number> {
  const cfg = await getPayConfig()
  const total = cfg.driverBasePay + distanceMiles * cfg.driverPerMile + tip
  return Math.round(total * 100) / 100
}

// Guarantee a delivery has a real driver_earnings before it is shown to a
// driver. Some order-creation paths (missing coords, POS test orders) leave
// driver_earnings null, and earnings used to be computed only at accept time —
// so the offer card fell back to a hardcoded "$4.00" placeholder and the
// driver saw a different number after accepting. This computes from the stored
// distance + tip, PERSISTS it to the row, and returns it, so the figure the
// driver is offered is the figure they're paid. Already-set earnings (> 0) are
// returned untouched — the quote is a snapshot, never re-priced out from under
// an accepted delivery.
export async function ensureDriverEarnings(
  deliveryId: string,
  distanceMiles: number | null | undefined,
  tip: number | null | undefined,
  current: number | null | undefined,
): Promise<number> {
  if (current != null && current > 0) return current
  const dist = Number.isFinite(distanceMiles) && (distanceMiles as number) > 0
    ? (distanceMiles as number)
    : 0
  const earnings = await quoteDriverEarnings(dist, tip || 0)
  const svc = createServiceClient()
  await svc.from('dd_deliveries').update({ driver_earnings: earnings }).eq('id', deliveryId)
  return earnings
}
