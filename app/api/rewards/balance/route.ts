import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

/**
 * A customer's DonutDash Cash, by phone number, for the public site.
 *
 * The code is checked HERE, against Twilio, before any balance is read.
 *
 * /api/verify/check already exists and returns { verified: true } to the
 * browser, so the obvious build would have been to call it from the page and
 * then ask this route for the balance. That would be no protection at all:
 * the only thing standing between a stranger and someone's balance would be a
 * JSON field the stranger's own browser sends. Whoever holds the phone has to
 * prove it to the same request that returns the data.
 *
 * Balances are per shop, so the answer is a list: what each shop owes this
 * customer, spendable only at that shop.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body?.phone)
  const code = String(body?.code ?? '').trim()
  if (!phone) {
    return NextResponse.json({ error: 'Enter a 10-digit mobile number.' }, { status: 400 })
  }
  if (!/^\d{4,10}$/.test(code)) {
    return NextResponse.json({ error: 'Enter the code we texted you.' }, { status: 400 })
  }

  // Two limits, because they stop different things. The per-phone limit caps
  // guessing at one number; the per-IP limit stops someone walking through
  // many numbers from one machine, which the per-phone limit alone would
  // happily allow.
  const ip = getClientIp(req.headers)
  const byPhone = await checkRateLimit(`rewards-balance:phone:${phone}`, 10, 60 * 60_000)
  if (!byPhone.allowed) {
    return NextResponse.json({ error: 'Too many tries for this number. Try again in an hour.' }, { status: 429 })
  }
  const byIp = await checkRateLimit(`rewards-balance:ip:${ip}`, 30, 60 * 60_000)
  if (!byIp.allowed) {
    return NextResponse.json({ error: 'Too many tries. Try again later.' }, { status: 429 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!accountSid || !authToken || !serviceSid) {
    return NextResponse.json({ error: 'Verification is not configured.' }, { status: 500 })
  }

  // Twilio wants E.164; normalizePhone gives us 10 US digits.
  const e164 = `+1${phone}`
  try {
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: e164, Code: code }),
      },
    )
    const data = await res.json()
    if (!res.ok || data.status !== 'approved') {
      return NextResponse.json({ error: 'That code is not right. Try again.' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not check that code. Try again.' }, { status: 502 })
  }

  const svc = createServiceClient()

  // The live record for this number. Merged duplicates are excluded by the
  // same rule the unique index uses, so this is the survivor or nothing.
  const { data: customer } = await svc
    .from('dd_users')
    .select('id, name')
    .eq('phone_normalized', phone)
    .eq('role', 'customer')
    .is('merged_into', null)
    .maybeSingle()

  if (!customer) {
    // Verified, but we have never seen them. Not an error — they just have no
    // balance yet, and saying so plainly beats an empty screen.
    return NextResponse.json({ found: false, shops: [] })
  }

  const { data: wallets } = await svc
    .from('dd_cash_wallets')
    .select('balance_cents, lifetime_earned_cents, lifetime_redeemed_cents, shop_id')
    .eq('customer_id', customer.id)
    .order('balance_cents', { ascending: false })

  // Shop names are fetched separately rather than as an embedded
  // dd_shops(...) join. The join would be tidier and is one schema-cache
  // refresh away from working at any moment: PostgREST resolves embeds from
  // the foreign key, so for a window after the per-shop migration adds that
  // key the embed fails with "could not find a relationship" and this page
  // would show every customer a blank balance. Two plain selects have no such
  // dependency.
  //
  // This also filters to shops still running the programme: a balance at a
  // shop that has withdrawn cannot be spent, and showing it as spendable
  // would be a promise we cannot keep. It stays in the ledger either way.
  const walletShopIds = [...new Set((wallets ?? []).map((w) => w.shop_id))]
  const { data: shopRows } = walletShopIds.length
    ? await svc
        .from('dd_shops')
        .select('id, name, city, state, rewards_enabled')
        .in('id', walletShopIds)
    : { data: [] as { id: string; name: string; city: string | null; state: string | null; rewards_enabled: boolean | null }[] }
  const byId = new Map((shopRows ?? []).map((s) => [s.id, s]))

  const shops = (wallets ?? [])
    .filter((w) => byId.get(w.shop_id)?.rewards_enabled)
    .map((w) => {
      const shop = byId.get(w.shop_id)
      return {
        shop_name: shop?.name ?? 'DonutDash shop',
        city: shop?.city ?? null,
        state: shop?.state ?? null,
        balance_cents: Number(w.balance_cents ?? 0),
        lifetime_earned_cents: Number(w.lifetime_earned_cents ?? 0),
        lifetime_redeemed_cents: Number(w.lifetime_redeemed_cents ?? 0),
      }
    })

  // First name only. The full name adds nothing a customer checking their own
  // balance needs, and the less this route hands back the less a verified
  // session is worth to anyone who should not have it.
  const firstName = (customer.name ?? '').trim().split(/\s+/)[0] || null

  return NextResponse.json({ found: true, first_name: firstName, shops })
}
