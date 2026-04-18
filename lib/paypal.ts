/**
 * PayPal Platform API helpers
 */

const getBaseUrl = () =>
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token
  }

  const clientId = process.env.PAYPAL_CLIENT_ID!
  const secret = process.env.PAYPAL_CLIENT_SECRET!

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`PayPal auth failed: ${data.error_description || data.error || 'unknown'}`)
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

interface CreateOrderParams {
  orderId: string       // DonutDash order ID (reference)
  amount: number        // total in USD
  description: string   // e.g. "DonutDash Order #AB12CD34"
  returnUrl: string     // redirect after approval
  cancelUrl: string     // redirect on cancel
}

export async function createPayPalOrder(params: CreateOrderParams) {
  const token = await getAccessToken()

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: params.orderId,
        description: params.description,
        amount: {
          currency_code: 'USD',
          value: params.amount.toFixed(2),
        },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'DonutDash',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
          },
        },
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('PayPal create order error:', JSON.stringify(data))
    throw new Error(data.message || 'Failed to create PayPal order')
  }

  return data
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken()

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('PayPal capture error:', JSON.stringify(data))
    throw new Error(data.message || 'Failed to capture PayPal payment')
  }

  return data
}
