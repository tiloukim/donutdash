import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Mode = 'flat' | 'percent'

async function getShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  return shop ? { shop, svc } : null
}

function nextPrice(current: number, mode: Mode, value: number) {
  if (mode === 'flat') return Math.max(0, Math.round(value * 100) / 100)
  // percent: positive = increase, negative = decrease
  const factor = 1 + value / 100
  return Math.max(0, Math.round(current * factor * 100) / 100)
}

export async function POST(req: NextRequest) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const mode: Mode = body.mode === 'percent' ? 'percent' : 'flat'
  const value = Number(body.value)
  const category = typeof body.category === 'string' && body.category !== 'all' ? body.category : null
  const preview = !!body.preview

  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
  }
  if (mode === 'flat' && value < 0) {
    return NextResponse.json({ error: 'Flat price cannot be negative' }, { status: 400 })
  }
  if (mode === 'percent' && (value < -100 || value > 1000)) {
    return NextResponse.json({ error: 'Percent must be between -100 and 1000' }, { status: 400 })
  }

  let query = ctx.svc.from('dd_menu_items').select('id, name, price, category').eq('shop_id', ctx.shop.id)
  if (category) query = query.eq('category', category)
  const { data: items, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changes = (items || [])
    .map(i => {
      const current = Number(i.price) || 0
      const next = nextPrice(current, mode, value)
      return { id: i.id, name: i.name, category: i.category, old_price: current, new_price: next }
    })
    .filter(c => c.old_price !== c.new_price)

  if (preview) {
    return NextResponse.json({ changes, count: changes.length })
  }

  if (changes.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No prices needed changes.' })
  }

  // Apply updates. Supabase has no batch UPDATE-with-different-values, so we
  // run one update per row. For typical donut shop menu sizes (<100 items)
  // this is fine; if menus grow large, switch to a Postgres function.
  let updated = 0
  for (const c of changes) {
    const { error: updErr } = await ctx.svc
      .from('dd_menu_items')
      .update({ price: c.new_price })
      .eq('id', c.id)
      .eq('shop_id', ctx.shop.id)
    if (!updErr) updated++
  }

  return NextResponse.json({ updated, total: changes.length })
}
