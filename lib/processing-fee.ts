/**
 * Card processing cost on an order.
 *
 * Admin Profit counted commission + fees + tip, less driver pay, and stopped
 * there — as if taking the money were free. It isn't: the processor takes a
 * percentage plus a flat amount off every card transaction, which on a $36
 * order is more than a third of the reported margin.
 *
 * Rates live in dd_platform_settings so they can be corrected without a
 * deploy when a processor or plan changes. Defaults match the effective rate
 * observed on the Square statement (2.6% + $0.15).
 */
export const DEFAULT_PROCESSOR_PCT = 2.6
export const DEFAULT_PROCESSOR_FLAT = 0.15

export interface ProcessorRates {
  pct: number
  flat: number
}

/** Cash takes no processor cut. Everything else does. */
export function computeProcessingFee(
  total: number,
  paymentMethod: string | null | undefined,
  rates: ProcessorRates,
): number {
  if (!(total > 0)) return 0
  if (paymentMethod === 'cash') return 0
  return Math.round((total * (rates.pct / 100) + rates.flat) * 100) / 100
}

/**
 * What the platform actually keeps: commission and fees, plus the tip it
 * collected, less what it pays the driver, less what the processor takes.
 *
 * The tip is both collected and paid out — it nets to zero, and is included
 * on both sides only so the figure reconciles against the order total.
 */
export function computeAdminProfit(input: {
  subtotal: number
  commissionRate: number
  serviceFee: number
  deliveryFee: number
  smallOrderFee: number
  tip: number
  driverEarnings: number
  processingFee: number
}): number {
  const gross =
    input.subtotal * input.commissionRate +
    input.serviceFee +
    input.deliveryFee +
    input.smallOrderFee +
    input.tip
  return Math.round((gross - input.driverEarnings - input.processingFee) * 100) / 100
}
