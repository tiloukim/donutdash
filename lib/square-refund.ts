import { SquareClient, SquareEnvironment } from 'square'

function getSquareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })
}

// Refund a Square payment for an order. Embedded card/wallet charges store the
// REAL Square payment id in dd_orders.payment_id, so pass it as `paymentId` and
// we refund it directly — reliable regardless of how many other payments the
// (shared) location has processed since. Only hosted-link orders (which store a
// link id) fall back to searching recent payments by note, and callers should
// always pass paymentId when they have it.
export async function refundSquareOrder(args: {
  orderId: string
  paymentId?: string | null
  amountCents: number
  reason: string
  idempotencyKey: string
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, paymentId, amountCents, reason, idempotencyKey } = args
  if (amountCents <= 0) return { success: false, error: 'Amount must be positive' }

  try {
    const square = getSquareClient()
    let resolvedPaymentId: string | undefined

    // Preferred path: the stored payment_id IS the real Square payment id.
    // Verify it's a completed payment before refunding.
    if (paymentId) {
      const res = await square.payments.get({ paymentId }).catch(() => null)
      const p = res?.payment as { id?: string; status?: string } | undefined
      if (p?.id && p.status === 'COMPLETED') resolvedPaymentId = p.id
    }

    // Fallback (hosted-link orders / legacy): find the payment by the note we
    // set at checkout ("DonutDash Order #<short>"). Bounded scan of recent
    // payments — only reached when the stored id isn't a real payment id.
    if (!resolvedPaymentId) {
      const { data: payments } = await square.payments.list({
        locationId: process.env.SQUARE_LOCATION_ID!,
        sortOrder: 'DESC',
        limit: 100,
      })
      const orderShort = orderId.slice(0, 8)
      const payment = (payments || []).find((p: any) =>
        p.note?.includes(orderShort) || p.orderId?.includes(orderId)
      )
      if (payment?.id) resolvedPaymentId = payment.id
    }

    if (!resolvedPaymentId) {
      return { success: false, error: 'Square payment not found for order' }
    }
    await square.refunds.refundPayment({
      idempotencyKey,
      paymentId: resolvedPaymentId,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      reason,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Refund failed' }
  }
}
