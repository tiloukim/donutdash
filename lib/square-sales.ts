import { SquareClient, SquareEnvironment } from 'square'

// Sales rung on the Square Register.
//
// The shop runs two registers side by side — its own POS writing to dd_orders,
// and Square. Neither knows about the other, so the day's real walk-in take is
// only visible by reading both.
//
// THE TRAP: this Square location is not only the Register. /api/checkout
// charges DonutDash's own online orders through the same Square account, so a
// naive "every payment at this location" listing would include delivery and
// pickup sales that dd_orders has already counted, and the day would read
// roughly double. Payments this app creates carry its application id;
// payments rung on the Register do not. That is the line between them, and it
// is the only reason this is safe to add up.

export type SquareSale = {
  id: string
  at: string
  /** 'CARD' | 'CASH' | ... as Square reports it. */
  tender: string
  cardBrand: string | null
  cardLast4: string | null
  /** What the customer paid, in dollars. */
  total: number
  tip: number
  /** What Square kept. Null until the payment settles, usually next day. */
  fee: number | null
  refunded: boolean
  refundAmount: number
}

export type SquareTotals = {
  net: number
  cash: number
  card: number
  cashCount: number
  cardCount: number
  tips: number
  fees: number
  refunds: number
  /** Payments left out because this app created them — shown, not hidden, so
   *  the filter can be checked rather than trusted. */
  excludedOnline: number
}

const dollars = (n: unknown) => Number(n ?? 0) / 100

function client() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })
}

export function squareSalesConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID)
}

/**
 * Register sales between two UTC instants.
 *
 * `beginIso`/`endIso` are the same day boundaries the DonutDash feed uses, so
 * both lists cover exactly the same window and their totals can be added.
 */
export async function fetchSquareSales(
  beginIso: string,
  endIso: string,
  limit = 500,
): Promise<{ sales: SquareSale[]; totals: SquareTotals; truncated: boolean }> {
  const locationId = process.env.SQUARE_LOCATION_ID
  const ownAppId = process.env.SQUARE_APP_ID
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is not set')

  const square = client()
  const sales: SquareSale[] = []
  let excludedOnline = 0

  // payments.list() returns a Page, not a plain response: pagination is
  // hasNextPage()/getNextPage(), and there is no `cursor` property on it.
  // Reading `(res as { cursor?: string }).cursor` therefore always produced
  // undefined, the loop exited after the first page, and everything beyond
  // it was silently invisible — a year that looked complete and was not.
  //
  // Square also returns SHORT pages: fewer rows than the page size with a
  // next page still waiting, so "we got less than a full page" was never
  // evidence there was no more.
  let page = await square.payments.list({
    locationId,
    beginTime: beginIso,
    endTime: endIso,
    sortOrder: 'DESC',
  })
  let pages = 0

  while (true) {
    for (const p of page.data ?? []) {
      if (p.status !== 'COMPLETED' && p.status !== 'APPROVED') continue

      // The whole point of the filter. Without an app id configured we cannot
      // tell the two apart, so nothing is claimed as a Register sale.
      const madeByThisApp = p.applicationDetails?.applicationId
      if (!ownAppId || (madeByThisApp && madeByThisApp === ownAppId)) {
        excludedOnline += 1
        continue
      }

      const refund = dollars(p.refundedMoney?.amount)
      sales.push({
        id: p.id ?? '',
        at: p.createdAt ?? '',
        tender: p.sourceType ?? 'UNKNOWN',
        cardBrand: p.cardDetails?.card?.cardBrand ?? null,
        cardLast4: p.cardDetails?.card?.last4 ?? null,
        total: dollars(p.totalMoney?.amount),
        tip: dollars(p.tipMoney?.amount),
        fee: p.processingFee?.length
          ? p.processingFee.reduce((n, f) => n + dollars(f.amountMoney?.amount), 0)
          : null,
        refunded: refund > 0,
        refundAmount: refund,
      })
      if (sales.length >= limit) break
    }

    pages += 1
    // Stop on the caller's cap, on the page cap, or when Square says there
    // is nothing further. The page cap is a runaway guard, not a limit on
    // the answer — `truncated` below reports when it actually bit.
    if (sales.length >= limit || pages >= 40 || !page.hasNextPage()) break
    page = await page.getNextPage()
  }

  const totals = sales.reduce<SquareTotals>(
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
    { net: 0, cash: 0, card: 0, cashCount: 0, cardCount: 0, tips: 0, fees: 0, refunds: 0, excludedOnline },
  )

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    sales,
    totals: {
      ...totals,
      net: round(totals.net), cash: round(totals.cash), card: round(totals.card),
      tips: round(totals.tips), fees: round(totals.fees), refunds: round(totals.refunds),
    },
    truncated: sales.length >= limit || pages >= 40,
  }
}
