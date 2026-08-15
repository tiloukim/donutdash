// ============================================================
// Welcome promo — platform-wide first-order discount for new customers.
//
// This is the SINGLE SOURCE OF TRUTH for whether a discount applies and
// how much it is. Both the validate endpoint (for display) and every
// checkout route (for the actual charge) call computeWelcomePromo so the
// amount is always derived on the server from the real subtotal — the
// client never gets to dictate the discount.
//
// Config lives in dd_platform_settings (key/value), edited from
// /admin/settings:
//   welcome_promo_enabled       'true' | 'false'
//   welcome_promo_type          'percent' | 'amount'
//   welcome_promo_value         percent (0-100) or flat dollars
//   welcome_promo_code          optional code, e.g. WELCOME10 (blank = no code)
//   welcome_promo_max_discount  optional $ cap for the percent type (0 = none)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface WelcomePromo {
  /** Code stored on the order + shown to the customer. */
  code: string
  /** Dollar amount to deduct, already rounded to cents and capped. */
  discount: number
  /** Human label, e.g. "Welcome offer (10% off)". */
  label: string
}

const SETTING_KEYS = [
  'welcome_promo_enabled',
  'welcome_promo_type',
  'welcome_promo_value',
  'welcome_promo_code',
  'welcome_promo_max_discount',
] as const

interface ComputeArgs {
  /** Service-role client (createServiceClient()). */
  svc: SupabaseClient
  /** dd_users.id of the customer being charged. */
  customerId: string
  /**
   * Customer phone. Guest checkout mints a fresh customer_id per order, so
   * customer_id alone can't tell a returning guest from a new one — we also
   * disqualify anyone whose phone has already ordered.
   */
  phone?: string | null
  /**
   * Full delivery address + city (delivery orders only). Second abuse gate:
   * an exact-normalized match to a prior order's address also disqualifies the
   * welcome offer. Omitted for pickup (no address).
   */
  deliveryAddress?: string | null
  deliveryCity?: string | null
  /** Order subtotal in dollars (food only — discount is computed off this). */
  subtotal: number
  /** Optional code the customer typed at checkout. */
  code?: string | null
  /**
   * Optional cap (dollars) = the platform's own discountable margin for this
   * order (service/small-order fees + commission — NOT tax, tip, or delivery,
   * which are earmarked for the state and the driver). The discount is clamped
   * to this so it can never drive the platform's application_fee negative
   * (which fails the charge) or dip into the shop's payout. Callers
   * that don't know the fee breakdown (e.g. the display-only validate
   * endpoint) omit it.
   */
  marginCap?: number
}

/**
 * Returns the welcome promo the customer is entitled to, or null.
 *
 * Eligibility:
 *   1. welcome_promo_enabled is 'true'
 *   2. customer is "new" — no prior non-cancelled orders (platform-wide)
 *   3. a typed code, if the platform has one configured, must match
 *   4. the computed discount is > $0
 */
export async function computeWelcomePromo({ svc, customerId, phone, deliveryAddress, deliveryCity, subtotal, code, marginCap }: ComputeArgs): Promise<WelcomePromo | null> {
  if (!customerId || !(subtotal > 0)) return null

  const { data: rows } = await svc
    .from('dd_platform_settings')
    .select('key, value')
    .in('key', SETTING_KEYS as unknown as string[])

  const cfg: Record<string, string> = {}
  for (const row of rows || []) cfg[row.key] = row.value

  if (cfg.welcome_promo_enabled !== 'true') return null

  const configuredCode = (cfg.welcome_promo_code || '').trim()
  // If the platform requires a code, a typed code must match it (case-insensitive).
  // No typed code is fine here — auto-apply still fires for new customers; we only
  // reject a code that was typed *and* wrong.
  if (configuredCode && code && code.trim().toLowerCase() !== configuredCode.toLowerCase()) {
    return null
  }

  // "New customer" = no prior orders on the platform. Orders are created at
  // checkout (Square, pre-capture), so we exclude cancelled rows to avoid
  // counting an abandoned attempt.
  const { count } = await svc
    .from('dd_orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')

  if ((count ?? 0) > 0) return null

  // Phone gate: a returning GUEST gets a brand-new customer_id each time, so the
  // count above is always 0 for them. Disqualify anyone whose phone has already
  // placed a (non-cancelled) order — the offer is once per person, not once per
  // anonymous session. Needs ≥10 digits to match; no/short phone skips the gate.
  if ((phone || '').replace(/\D/g, '').length >= 10) {
    const { data: usedBefore } = await svc.rpc('has_prior_order_by_phone', { p: phone })
    if (usedBefore === true) return null
  }

  // Address gate: exact-normalized match to a prior order's delivery address
  // (delivery orders only). Conservative on purpose — a genuinely new customer
  // in the same building (different unit) still qualifies.
  if (deliveryAddress && deliveryAddress.trim() && deliveryCity && deliveryCity.trim()) {
    const { data: addrUsed } = await svc.rpc('has_prior_order_by_address', {
      addr: deliveryAddress,
      city: deliveryCity,
    })
    if (addrUsed === true) return null
  }

  const type = cfg.welcome_promo_type === 'amount' ? 'amount' : 'percent'
  const value = parseFloat(cfg.welcome_promo_value || '0') || 0
  if (value <= 0) return null

  let discount: number
  let labelDetail: string
  if (type === 'percent') {
    discount = subtotal * (value / 100)
    const cap = parseFloat(cfg.welcome_promo_max_discount || '0') || 0
    if (cap > 0) discount = Math.min(discount, cap)
    labelDetail = `${value % 1 === 0 ? value : value.toFixed(1)}% off`
  } else {
    discount = value
    labelDetail = `$${value.toFixed(2)} off`
  }

  // Never discount more than the food subtotal; the charge math handles the
  // final clamp against the grand total.
  discount = Math.min(discount, subtotal)
  // Clamp to the platform's discountable margin so the promo can only ever come
  // out of platform earnings — never the shop payout, and never enough to fail
  // the charge. Degrades gracefully: the customer just gets a smaller discount.
  if (marginCap != null) discount = Math.min(discount, Math.max(0, marginCap))
  discount = Math.round(discount * 100) / 100
  if (discount <= 0) return null

  return {
    code: configuredCode || 'WELCOME',
    discount,
    label: `Welcome offer (${labelDetail})`,
  }
}
