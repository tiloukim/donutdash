import { SquareClient, SquareEnvironment } from 'square'

function getSquareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })
}

// dd_orders.payment_id stores the Square paymentLink id, not the payment id.
// Look up the actual payment via the note we set in checkout
// ("DonutDash Order #<short>") or by orderId match.
export async function refundSquareOrder(args: {
  orderId: string
  amountCents: number
  reason: string
  idempotencyKey: string
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, amountCents, reason, idempotencyKey } = args
  if (amountCents <= 0) return { success: false, error: 'Amount must be positive' }

  try {
    const square = getSquareClient()
    const { data: payments } = await square.payments.list({
      locationId: process.env.SQUARE_LOCATION_ID!,
      sortOrder: 'DESC',
      limit: 50,
    })
    const orderShort = orderId.slice(0, 8)
    const payment = (payments || []).find((p: any) =>
      p.note?.includes(orderShort) || p.orderId?.includes(orderId)
    )
    if (!payment?.id) {
      return { success: false, error: 'Square payment not found for order' }
    }
    await square.refunds.refundPayment({
      idempotencyKey,
      paymentId: payment.id,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      reason,
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Refund failed' }
  }
}
