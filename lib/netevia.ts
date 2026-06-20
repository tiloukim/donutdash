// Netevia payment gateway client.
//
// Wraps the Netevia REST gateway behind a typed semantic interface so
// the route handlers don't need to know the wire format. Modeled on the
// Netevia direct-post convention (REST + JSON, Basic auth, async webhook
// for terminal-initiated card-present flows).
//
// IMPORTANT: The exact endpoint paths and field names below are placeholders
// based on the standard NMI-derived gateway shape Netevia inherits. When
// the integration kickoff lands, verify against the live Netevia API
// reference and adjust `request()` / `mapResponse()` to match — the
// public surface (charge/refund/void/tokenize) and the response shape
// should stay stable so route handlers don't churn.

const SANDBOX_BASE = 'https://sandbox.netevia.com/api/v1'
const PRODUCTION_BASE = 'https://api.netevia.com/api/v1'

export type NeteviaEnv = 'sandbox' | 'production'
export type EntryMode = 'present' | 'keyed' | 'online' | 'recurring'

export interface NeteviaConfig {
  // Per-shop merchant credentials. Pulled from dd_shop_terminal_credentials
  // (existing) or a future dd_shop_gateway_credentials row — same auth
  // model as TPN/AuthKey.
  merchantId: string
  apiKey: string
  env: NeteviaEnv
  // Optional override — useful for staging/canary endpoints. Falls back
  // to SANDBOX_BASE / PRODUCTION_BASE.
  baseUrl?: string
}

// Discriminated-union result. Routes can `if (!r.ok) return error` and
// TypeScript narrows the success branch to the full payload — no any.
export type NeteviaResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      // Network / HTTP error vs gateway-level decline. Distinguishing
      // matters: 'declined' is a normal flow (show "Card declined" to
      // the cashier), 'error' is a bug or outage (retry / alert).
      kind: 'declined' | 'error'
      message: string
      code?: string
      // Whatever the gateway sent back, for the audit log.
      raw?: unknown
    }

// ─── Common response shape across charge/auth/capture/refund/void ───
export interface NeteviaTransaction {
  transactionId: string
  authCode: string | null
  // Cents. Echoes the request — useful when a partial approval comes
  // back (some issuers approve 80% of the requested amount).
  amountCents: number
  // Returned on charge/auth when the request included a tokenization
  // step. Routes persist this to dd_payments.netevia_token.
  token: string | null
  cardBrand: string | null
  cardLast4: string | null
  // Pacific-time settlement date the gateway assigned this txn to.
  // null if it'll batch tomorrow.
  batchDate: string | null
  responseCode: string
  responseMessage: string
  // Full response body for the audit log.
  raw: unknown
}

export interface ChargeArgs {
  amountCents: number
  tipCents?: number
  surchargeCents?: number
  // Either a one-time payment token (from Netevia hosted fields) or a
  // saved vault token. The terminal-initiated flow on the Dejavoo P8
  // skips this — the terminal sends the card data straight to Netevia.
  paymentToken?: string
  // Set true to also store this card to the vault. Returned token
  // ends up on the success payload.
  saveToVault?: boolean
  // Free-form description visible in the Netevia portal. Use the
  // dd_orders.short_code so support can correlate.
  description?: string
  orderRef?: string
  entryMode: EntryMode
  // Optional Netevia-side idempotency key. Default is order + amount,
  // set explicitly when retrying a previously-failed call.
  idempotencyKey?: string
}

export interface RefundArgs {
  // The original charge's gateway txn id. Netevia requires this — they
  // won't refund by amount + last4.
  originalTransactionId: string
  amountCents: number
  reason: string
  idempotencyKey: string
}

export interface VoidArgs {
  // Voids only work pre-settlement. Post-settlement = use refund.
  transactionId: string
  reason: string
  idempotencyKey: string
}

export interface TokenizeArgs {
  // Single-use token from Netevia hosted fields (web checkout) or
  // raw card data when called from a PCI-scoped service. The DonutDash
  // web/app never sees raw PAN — only the hosted-fields token.
  paymentToken: string
  // Optional shopper reference (dd_users.id) — Netevia indexes on this
  // so the admin can find "all cards saved by customer X."
  customerRef?: string
}

export interface TokenizeResult {
  token: string
  cardBrand: string | null
  cardLast4: string | null
  expirationMonth: number | null
  expirationYear: number | null
}

// ─── Client factory ────────────────────────────────────────────────────
export function getNeteviaClient(config: NeteviaConfig) {
  const baseUrl =
    config.baseUrl ?? (config.env === 'production' ? PRODUCTION_BASE : SANDBOX_BASE)

  async function request<T>(
    path: string,
    body: Record<string, unknown>,
    mapper: (raw: any) => T,
  ): Promise<NeteviaResult<T>> {
    let res: Response
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Netevia accepts Basic auth (merchant:key) or Bearer for the
          // newer endpoints. Verify against your portal's API key tab.
          Authorization: `Basic ${Buffer.from(`${config.merchantId}:${config.apiKey}`).toString('base64')}`,
        },
        body: JSON.stringify(body),
      })
    } catch (err: any) {
      return { ok: false, kind: 'error', message: err?.message ?? 'Network error' }
    }

    let json: any = null
    try {
      json = await res.json()
    } catch {
      return { ok: false, kind: 'error', message: `Non-JSON response (HTTP ${res.status})` }
    }

    if (!res.ok) {
      return {
        ok: false,
        kind: 'error',
        message: json?.error?.message ?? `HTTP ${res.status}`,
        code: json?.error?.code,
        raw: json,
      }
    }

    // Gateway-level decline — HTTP 200 with status:declined. Map to the
    // 'declined' branch so the cashier UI shows a card-decline message
    // instead of a generic "server error."
    if (json?.status === 'declined' || json?.responseCode?.startsWith?.('2')) {
      return {
        ok: false,
        kind: 'declined',
        message: json?.responseMessage ?? 'Card declined',
        code: json?.responseCode,
        raw: json,
      }
    }

    return { ok: true, data: mapper(json) }
  }

  function mapTransaction(raw: any): NeteviaTransaction {
    return {
      transactionId: raw.transactionId ?? raw.txnId ?? '',
      authCode: raw.authCode ?? null,
      amountCents: raw.amount ?? raw.amountCents ?? 0,
      token: raw.token ?? raw.savedToken ?? null,
      cardBrand: raw.cardBrand ?? raw.card?.brand ?? null,
      cardLast4: raw.cardLast4 ?? raw.card?.last4 ?? null,
      batchDate: raw.batchDate ?? null,
      responseCode: raw.responseCode ?? '',
      responseMessage: raw.responseMessage ?? '',
      raw,
    }
  }

  return {
    // Sale: auth + capture in one round-trip. Default for POS walk-ins
    // where the customer is standing right there. Tip-adjust flows should
    // use auth() + capture() instead so the tip can be added later.
    charge(args: ChargeArgs) {
      return request('/transactions/sale', {
        amount: args.amountCents,
        tip: args.tipCents ?? 0,
        surcharge: args.surchargeCents ?? 0,
        paymentToken: args.paymentToken,
        saveToVault: args.saveToVault ?? false,
        description: args.description,
        orderRef: args.orderRef,
        entryMode: args.entryMode,
        idempotencyKey: args.idempotencyKey,
      }, mapTransaction)
    },

    // Authorization only — places a hold but doesn't move money. Capture
    // later (within ~7 days, varies by card brand) to settle.
    auth(args: ChargeArgs) {
      return request('/transactions/auth', {
        amount: args.amountCents,
        paymentToken: args.paymentToken,
        saveToVault: args.saveToVault ?? false,
        description: args.description,
        orderRef: args.orderRef,
        entryMode: args.entryMode,
        idempotencyKey: args.idempotencyKey,
      }, mapTransaction)
    },

    // Capture a prior auth, optionally with a different amount (tip
    // adjustment). amountCents = total to settle, NOT delta from the auth.
    capture(args: {
      authTransactionId: string
      amountCents: number
      tipCents?: number
      idempotencyKey: string
    }) {
      return request(`/transactions/${encodeURIComponent(args.authTransactionId)}/capture`, {
        amount: args.amountCents,
        tip: args.tipCents ?? 0,
        idempotencyKey: args.idempotencyKey,
      }, mapTransaction)
    },

    refund(args: RefundArgs) {
      return request(`/transactions/${encodeURIComponent(args.originalTransactionId)}/refund`, {
        amount: args.amountCents,
        reason: args.reason,
        idempotencyKey: args.idempotencyKey,
      }, mapTransaction)
    },

    void(args: VoidArgs) {
      return request(`/transactions/${encodeURIComponent(args.transactionId)}/void`, {
        reason: args.reason,
        idempotencyKey: args.idempotencyKey,
      }, mapTransaction)
    },

    tokenize(args: TokenizeArgs): Promise<NeteviaResult<TokenizeResult>> {
      return request('/vault/cards', {
        paymentToken: args.paymentToken,
        customerRef: args.customerRef,
      }, (raw: any) => ({
        token: raw.token ?? raw.vaultId,
        cardBrand: raw.cardBrand ?? raw.card?.brand ?? null,
        cardLast4: raw.cardLast4 ?? raw.card?.last4 ?? null,
        expirationMonth: raw.expirationMonth ?? raw.card?.expMonth ?? null,
        expirationYear: raw.expirationYear ?? raw.card?.expYear ?? null,
      }))
    },

    // Manual batch close. Most accounts auto-batch at the configured
    // cutoff time; this is for shops on manual-batch mode or for forcing
    // a settlement before a long weekend.
    closeBatch(args: { idempotencyKey: string }): Promise<NeteviaResult<{ batchNumber: string; txnCount: number; grossCents: number }>> {
      return request('/batches/close', {
        idempotencyKey: args.idempotencyKey,
      }, (raw: any) => ({
        batchNumber: raw.batchNumber ?? raw.batchId,
        txnCount: raw.txnCount ?? 0,
        grossCents: raw.amount ?? 0,
      }))
    },
  }
}

// ─── Per-shop client resolver ──────────────────────────────────────────
// v1: single merchant account for all shops, creds in env vars. When we
// move to a per-franchise MID model, swap this for a Supabase lookup
// against a future dd_shop_gateway_credentials table — same shape as
// dd_shop_terminal_credentials. Route handlers should not need to change.
export function getNeteviaClientForShop(_shopId: string) {
  const merchantId = process.env.NETEVIA_MERCHANT_ID
  const apiKey = process.env.NETEVIA_API_KEY
  if (!merchantId || !apiKey) {
    throw new Error('NETEVIA_MERCHANT_ID and NETEVIA_API_KEY must be set')
  }
  return getNeteviaClient({
    merchantId,
    apiKey,
    env: process.env.NETEVIA_ENV === 'production' ? 'production' : 'sandbox',
  })
}

// ─── Webhook signature verification ────────────────────────────────────
// Netevia signs webhook bodies with HMAC-SHA256 using a shared secret
// configured per-merchant in the portal. The signature arrives in
// the X-Netevia-Signature header as hex.
//
// Use a constant-time compare so a timing-attack can't probe the secret
// one byte at a time.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWebhookSignature(args: {
  rawBody: string
  signatureHeader: string | null
  secret: string
}): boolean {
  if (!args.signatureHeader) return false
  const expected = createHmac('sha256', args.secret).update(args.rawBody).digest('hex')
  const provided = args.signatureHeader.trim().toLowerCase()
  // timingSafeEqual throws on length mismatch — guard explicitly.
  if (expected.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
