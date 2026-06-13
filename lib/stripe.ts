import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return stripeInstance
}

// Refund a Stripe charge by payment_intent or charge id. amountCents=null
// triggers a full refund. idempotencyKey prevents duplicates on retry.
export async function refundStripePayment(args: {
  paymentId: string
  amountCents?: number | null
  reason?: string
  idempotencyKey: string
}): Promise<{ success: boolean; error?: string; refundId?: string }> {
  try {
    const stripe = getStripe()
    const refund = await stripe.refunds.create(
      {
        payment_intent: args.paymentId.startsWith('pi_') ? args.paymentId : undefined,
        charge: args.paymentId.startsWith('ch_') ? args.paymentId : undefined,
        amount: args.amountCents ?? undefined,
        metadata: args.reason ? { reason: args.reason } : undefined,
      },
      { idempotencyKey: args.idempotencyKey },
    )
    return { success: true, refundId: refund.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Stripe error'
    return { success: false, error: msg }
  }
}

