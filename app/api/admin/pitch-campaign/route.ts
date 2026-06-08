import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET  /api/admin/pitch-campaign  — list all recipients
// POST /api/admin/pitch-campaign  — add a recipient
// Admin / manager only.

async function authorize() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || (caller.role !== 'admin' && caller.role !== 'manager')) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { svc, caller }
}

export async function GET() {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data: rows, error } = await a.svc
    .from('dd_pitch_campaign_recipients')
    .select(`
      id, shop_id, recipient_email, recipient_name, recipient_phone, notes,
      status, last_sent_at, send_count, unsubscribed_at, created_at,
      shop:dd_shops(name, slug, city, is_claimed)
    `)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipients: rows ?? [] })
}

interface PostBody {
  shop_id: string
  recipient_email: string
  recipient_name?: string
  recipient_phone?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.recipient_email) {
    return NextResponse.json({ error: 'shop_id and recipient_email required' }, { status: 400 })
  }
  // Light email validation — full validation happens at send time.
  if (!/^\S+@\S+\.\S+$/.test(body.recipient_email.trim())) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const { data, error } = await a.svc
    .from('dd_pitch_campaign_recipients')
    .insert({
      shop_id: body.shop_id,
      recipient_email: body.recipient_email.trim().toLowerCase(),
      recipient_name: body.recipient_name?.trim() || null,
      recipient_phone: body.recipient_phone?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: a.caller.id,
    })
    .select('id')
    .single()

  if (error) {
    // Unique-index conflict (shop + email already on the list) is the
    // common one — surface as 409 so the admin UI can show a friendly
    // "this email is already targeting this shop" message.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This email is already on the list for this shop' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
