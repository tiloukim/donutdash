import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, email, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { html, subject, email } = await req.json()
  if (!html || !subject) return NextResponse.json({ error: 'Missing html or subject' }, { status: 400 })

  // Send to provided email or user's email
  const to = email || ddUser.email || user.email
  if (!to) return NextResponse.json({ error: 'No email address found' }, { status: 400 })

  const ok = await sendEmail(to, subject, html)
  if (!ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })

  return NextResponse.json({ ok: true, to })
}
