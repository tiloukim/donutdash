import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

// 'flat'    — set to exactly this price
// 'percent' — base + this % of base
// 'amount'  — base + this many dollars
type Mode = 'flat' | 'percent' | 'amount'

// Which price column is being written. 'online' derives from the COUNTER
// price, which is the whole point: an owner sets the counter price once and
// says "online is that plus 20%" to cover the commission DonutDash takes on
// app orders and the counter doesn't.
type Target = 'counter' | 'online'

async function getShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const shop = await getActiveShop(svc, ddUser.id)
  return shop ? { shop, svc } : null
}

/** Round up to a tidy increment. Markups produce prices like $1.62, and a
 *  counter that deals in coins wants $1.65. Rounds UP so a markup intended
 *  to cover a cost never lands under it. */
function roundTo(n: number, step: number) {
  if (!step || step <= 0) return Math.round(n * 100) / 100
  return Math.round(Math.ceil(n / step) * step * 100) / 100
}

function nextPrice(base: number, mode: Mode, value: number, step = 0) {
  if (mode === 'flat') return Math.max(0, roundTo(value, step))
  if (mode === 'amount') return Math.max(0, roundTo(base + value, step))
  // percent: positive = increase, negative = decrease
  return Math.max(0, roundTo(base * (1 + value / 100), step))
}

export async function POST(req: NextRequest) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const mode: Mode = body.mode === 'percent' ? 'percent' : body.mode === 'amount' ? 'amount' : 'flat'
  const target: Target = body.target === 'online' ? 'online' : 'counter'
  const value = Number(body.value)
  const step = Number(body.round_to) || 0
  // Variant options are priced independently of the item, and on this menu
  // that is where the money is — a dozen is $13.50 against a $1.25 single,
  // so a markup that skips options misses most of the ticket.
  const includeVariants = body.include_variants !== false
  const category = typeof body.category === 'string' && body.category !== 'all' ? body.category : null
  const preview = !!body.preview

  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
  }
  if (mode === 'amount' && value < -10000) {
    return NextResponse.json({ error: 'Amount is out of range' }, { status: 400 })
  }
  if (mode === 'flat' && value < 0) {
    return NextResponse.json({ error: 'Flat price cannot be negative' }, { status: 400 })
  }
  if (mode === 'percent' && (value < -100 || value > 1000)) {
    return NextResponse.json({ error: 'Percent must be between -100 and 1000' }, { status: 400 })
  }

  let query = ctx.svc
    .from('dd_menu_items')
    .select('id, name, price, online_price, variants, category')
    .eq('shop_id', ctx.shop.id)
  if (category) query = query.eq('category', category)
  const { data: items, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type OptRow = { name: string; price: number; online_price?: number | null }
  type Row = {
    id: string; name: string; price: number
    online_price: number | null
    variants: { name: string; options: (string | OptRow)[] }[] | null
    category: string
  }

  const changes = ((items || []) as Row[])
    .map((i) => {
      const counter = Number(i.price) || 0
      // Online is always derived from the counter price, never from whatever
      // online price happens to be set — otherwise applying +20% twice
      // compounds to 44% and nobody notices until a customer does.
      const base = counter
      const current = target === 'online'
        ? (i.online_price != null ? Number(i.online_price) : counter)
        : counter
      const next = nextPrice(base, mode, value, step)

      const optionChanges: { group: string; name: string; old_price: number; new_price: number }[] = []
      let nextVariants = i.variants
      if (includeVariants && i.variants?.length) {
        nextVariants = i.variants.map((g) => ({
          ...g,
          options: g.options.map((o) => {
            if (typeof o === 'string') return o
            const optCounter = Number(o.price) || 0
            if (optCounter <= 0) return o
            const optCurrent = target === 'online'
              ? (o.online_price != null ? Number(o.online_price) : optCounter)
              : optCounter
            const optNext = nextPrice(optCounter, mode, value, step)
            if (optNext !== optCurrent) {
              optionChanges.push({ group: g.name, name: o.name, old_price: optCurrent, new_price: optNext })
            }
            return target === 'online'
              ? { ...o, online_price: optNext }
              : { ...o, price: optNext }
          }),
        }))
      }

      return {
        id: i.id, name: i.name, category: i.category,
        old_price: current, new_price: next,
        options: optionChanges,
        _nextVariants: nextVariants,
      }
    })
    .filter((c) => c.old_price !== c.new_price || c.options.length > 0)

  if (preview) {
    return NextResponse.json({
      target, mode,
      // Strip the payload the UI has no use for.
      changes: changes.map(({ _nextVariants, ...c }) => c),
      count: changes.length,
      option_count: changes.reduce((n, c) => n + c.options.length, 0),
    })
  }

  if (changes.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No prices needed changes.' })
  }

  // Apply updates. Supabase has no batch UPDATE-with-different-values, so we
  // run one update per row. For typical donut shop menu sizes (<100 items)
  // this is fine; if menus grow large, switch to a Postgres function.
  let updated = 0
  for (const c of changes) {
    const patch: Record<string, unknown> = target === 'online'
      ? { online_price: c.new_price }
      : { price: c.new_price }
    if (includeVariants) patch.variants = c._nextVariants
    const { error: updErr } = await ctx.svc
      .from('dd_menu_items')
      .update(patch)
      .eq('id', c.id)
      .eq('shop_id', ctx.shop.id)
    if (!updErr) updated++
  }

  return NextResponse.json({ updated, total: changes.length, target, mode })
}
