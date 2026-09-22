import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

/**
 * Each shop's own Square account.
 *
 * ── Why this exists ──
 * donutdash.app holds ONE Square token and it belongs to DonutDash's own
 * seller account, which charges the online delivery orders. A shop's
 * register is a different Square seller entirely — Top Donuts' is
 * RT6VKT2ZQRKPB in the gotopdonuts account, which this platform's token
 * cannot see and never will. Without per-shop credentials the Walk-in Sales
 * page could only ever show DonutDash's own online orders under a heading
 * claiming they were the shop's register, which is exactly what it did
 * before that panel was removed.
 *
 * ── What is being held ──
 * A Square PRODUCTION ACCESS TOKEN grants full control of that merchant's
 * account: payments, refunds, catalog, bank details. Encrypting it at rest
 * protects against a database leak. It does not protect against anyone who
 * can read this app's environment, because the key lives there.
 *
 * Square OAuth is the safer shape — the shop authorises on Square's own
 * site, the platform receives a scoped read-only token, and the shop can
 * revoke it without rotating anything. That was the recommendation; pasted
 * tokens were chosen for speed, and this file is written so the read path
 * (getShopSquare, fetchShopSquareSales) does not care which way the token
 * arrived. Adding OAuth later means changing how the token is obtained, not
 * how it is used.
 */

const ALGO = 'aes-256-gcm'

function key(): Buffer {
  const raw = process.env.SQUARE_CREDENTIALS_KEY
  if (!raw) throw new Error('SQUARE_CREDENTIALS_KEY is not set')
  // Accept any passphrase length by hashing to exactly 32 bytes, rather than
  // failing at encrypt time on a key that looked fine when it was pasted in.
  return createHash('sha256').update(raw).digest()
}

export function credentialsKeyConfigured(): boolean {
  return Boolean(process.env.SQUARE_CREDENTIALS_KEY)
}

/** v1:<iv>:<authTag>:<ciphertext>, each part base64. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

export function decryptToken(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored Square token is not in the expected format')
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

const SQUARE_API = 'https://connect.squareup.com'
const SQUARE_VERSION = '2025-01-23'

export interface SquareLocation {
  id: string
  name: string
  status?: string
  city?: string
}

/**
 * Locations a token can see. Doubles as the validity check when connecting:
 * a token that cannot list locations cannot read payments either, and
 * finding out at save time beats finding out as a silent zero on a report.
 */
export async function listSquareLocations(token: string): Promise<SquareLocation[]> {
  const res = await fetch(`${SQUARE_API}/v2/locations`, {
    headers: { Authorization: `Bearer ${token}`, 'Square-Version': SQUARE_VERSION },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({})) as {
    locations?: { id?: string; name?: string; status?: string; address?: { locality?: string } }[]
    errors?: { detail?: string }[]
  }
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? 'Square rejected that token. Check you copied the PRODUCTION access token.'
        : body.errors?.[0]?.detail ?? `Square returned ${res.status}.`,
    )
  }
  return (body.locations ?? [])
    .filter((l): l is { id: string; name?: string; status?: string; address?: { locality?: string } } => Boolean(l.id))
    .map((l) => ({ id: l.id, name: l.name ?? l.id, status: l.status, city: l.address?.locality }))
}

export interface ShopSquareSale {
  id: string
  at: string
  tender: string
  cardBrand: string | null
  cardLast4: string | null
  total: number
  tip: number
  fee: number | null
  refundAmount: number
}

export interface ShopSquareTotals {
  net: number
  cash: number
  card: number
  cashCount: number
  cardCount: number
  tips: number
  fees: number
  refunds: number
}

interface SquarePayment {
  id?: string
  status?: string
  created_at?: string
  source_type?: string
  total_money?: { amount?: number }
  tip_money?: { amount?: number }
  refunded_money?: { amount?: number }
  processing_fee?: { amount_money?: { amount?: number } }[]
  card_details?: { card?: { card_brand?: string; last_4?: string } }
}

const dollars = (n: unknown) => (Number(n ?? 0) || 0) / 100
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * One shop's Square payments between two instants.
 *
 * No application-id filtering, deliberately. That filter existed to separate
 * DonutDash's online orders from register sales inside one shared account.
 * Here the account IS the shop's, so everything in it is the shop's — and
 * filtering by an id belonging to a different seller would have excluded
 * nothing while looking like a safeguard.
 *
 * Paginates with the raw cursor the REST API returns. Short pages are normal:
 * fewer rows than asked for does not mean there is no next page.
 */
export async function fetchShopSquareSales(
  token: string,
  locationId: string,
  beginIso: string,
  endIso: string,
  maxPages = 20,
): Promise<{ sales: ShopSquareSale[]; totals: ShopSquareTotals; truncated: boolean }> {
  const sales: ShopSquareSale[] = []
  let cursor: string | undefined
  let pages = 0

  do {
    const url = new URL('/v2/payments', SQUARE_API)
    url.searchParams.set('location_id', locationId)
    url.searchParams.set('begin_time', beginIso)
    url.searchParams.set('end_time', endIso)
    url.searchParams.set('limit', '100')
    url.searchParams.set('sort_order', 'DESC')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Square-Version': SQUARE_VERSION },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { errors?: { detail?: string }[] }
      throw new Error(body.errors?.[0]?.detail ?? `Square returned ${res.status}.`)
    }
    const body = await res.json() as { payments?: SquarePayment[]; cursor?: string }

    for (const p of body.payments ?? []) {
      if (p.status && p.status !== 'COMPLETED' && p.status !== 'APPROVED') continue
      sales.push({
        id: p.id ?? '',
        at: p.created_at ?? '',
        tender: p.source_type ?? 'UNKNOWN',
        cardBrand: p.card_details?.card?.card_brand ?? null,
        cardLast4: p.card_details?.card?.last_4 ?? null,
        total: dollars(p.total_money?.amount),
        tip: dollars(p.tip_money?.amount),
        fee: p.processing_fee?.length
          ? p.processing_fee.reduce((n, f) => n + dollars(f.amount_money?.amount), 0)
          : null,
        refundAmount: dollars(p.refunded_money?.amount),
      })
    }

    cursor = body.cursor
    pages += 1
  } while (cursor && pages < maxPages)

  const totals = sales.reduce<ShopSquareTotals>(
    (t, s) => {
      const net = s.total - s.refundAmount
      t.net += net
      t.tips += s.tip
      t.fees += s.fee ?? 0
      t.refunds += s.refundAmount
      if (s.tender === 'CASH') { t.cash += net; t.cashCount += 1 }
      else { t.card += net; t.cardCount += 1 }
      return t
    },
    { net: 0, cash: 0, card: 0, cashCount: 0, cardCount: 0, tips: 0, fees: 0, refunds: 0 },
  )

  return {
    sales,
    totals: {
      ...totals,
      net: round2(totals.net), cash: round2(totals.cash), card: round2(totals.card),
      tips: round2(totals.tips), fees: round2(totals.fees), refunds: round2(totals.refunds),
    },
    truncated: Boolean(cursor) && pages >= maxPages,
  }
}
