import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, email, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { subject, email, pdfBase64, filename } = await req.json()
  if (!subject || !pdfBase64) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const to = email || ddUser.email || user.email
  if (!to) return NextResponse.json({ error: 'No email address found' }, { status: 400 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'DonutDash <notifications@donutdash.app>',
      to,
      subject,
      html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2 style="color:#FF1493">DonutDash</h2><p>Please find your <b>${filename || 'document'}</b> attached to this email.</p><p style="color:#888;font-size:13px">This document was generated from your DonutDash shop dashboard.</p></div>`,
      attachments: [{
        filename: filename || 'document.pdf',
        content: pdfBase64,
      }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  return NextResponse.json({ ok: true, to })
}
