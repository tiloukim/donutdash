import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  // Format as XXXX-XXXX-XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`
}

const VALID_AMOUNTS = [10, 25, 50, 100]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ purchased: [], received: [] })
    }

    const [purchased, received] = await Promise.all([
      svc.from('dd_gift_cards').select('*').eq('purchased_by', ddUser.id).order('created_at', { ascending: false }),
      svc.from('dd_gift_cards').select('*').eq('redeemed_by', ddUser.id).order('redeemed_at', { ascending: false }),
    ])

    return NextResponse.json({
      purchased: purchased.data || [],
      received: received.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admin can create gift cards (no payment integration yet)
    if (ddUser.role !== 'admin') {
      return NextResponse.json({ error: 'Gift card purchasing coming soon!' }, { status: 403 })
    }

    const { allowed } = await checkRateLimit(`giftcard:${ddUser.id}`, 10, 60000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { amount, recipient_email, recipient_name, message } = await request.json()

    if (!VALID_AMOUNTS.includes(Number(amount))) {
      return NextResponse.json({ error: 'Invalid amount. Choose $10, $25, $50, or $100.' }, { status: 400 })
    }

    const code = generateCode()

    const { data: card, error } = await svc
      .from('dd_gift_cards')
      .insert({
        code,
        amount: Number(amount),
        balance: Number(amount),
        purchased_by: ddUser.id,
        recipient_email: recipient_email || null,
        recipient_name: recipient_name || null,
        message: message || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ card }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
