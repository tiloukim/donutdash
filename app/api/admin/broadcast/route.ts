import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPage } from '@/lib/admin-auth'
import { sendSMS, sendEmail } from '@/lib/sms'

export const dynamic = 'force-dynamic'

const GROUPS = ['drivers', 'customers', 'admins'] as const
type Group = typeof GROUPS[number]

const ADMIN_ROLES = ['admin', 'general_manager', 'field_manager', 'marketing_manager']

function rolesFor(group: Group): string[] {
  if (group === 'drivers') return ['driver']
  if (group === 'customers') return ['customer']
  return ADMIN_ROLES
}

function rolesForGroups(groups: Group[]): string[] {
  return [...new Set(groups.flatMap(rolesFor))]
}

async function requireBroadcaster() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!caller || !canAccessAdminPage(caller.role, '/admin/broadcast')) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { svc }
}

// GET — recipient counts so the UI can show how many will be reached
export async function GET() {
  const gate = await requireBroadcaster()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { svc } = gate

  const tally = async (roles: string[]) => {
    const { data } = await svc.from('dd_users').select('email, phone, is_active').in('role', roles)
    const active = (data || []).filter(u => u.is_active !== false)
    return {
      total: active.length,
      email: active.filter(u => u.email).length,
      phone: active.filter(u => u.phone).length,
    }
  }
  const [drivers, customers, admins] = await Promise.all([
    tally(['driver']), tally(['customer']), tally(ADMIN_ROLES),
  ])
  return NextResponse.json({ drivers, customers, admins })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function broadcastEmailHtml(subject: string, message: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#fff;">
    <div style="background:#FF8C00;padding:22px 20px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">DonutDash&trade;</h1>
    </div>
    <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
      <h2 style="margin:0 0 14px;color:#222;font-size:19px;">${esc(subject)}</h2>
      <div style="color:#444;font-size:15px;line-height:1.6;">${esc(message).replace(/\n/g, '<br>')}</div>
    </div>
  </div>`
}

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<boolean>) {
  let sent = 0, failed = 0
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn))
    for (const ok of results) ok ? sent++ : failed++
  }
  return { sent, failed }
}

// POST — send the broadcast
export async function POST(req: NextRequest) {
  const gate = await requireBroadcaster()
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { svc } = gate

  const { groups, channels, subject, message } = await req.json() as {
    groups: Group[]
    channels: { email?: boolean; sms?: boolean }
    subject?: string
    message?: string
  }

  const selected = Array.isArray(groups) ? groups.filter((g): g is Group => GROUPS.includes(g as Group)) : []
  if (selected.length === 0) return NextResponse.json({ error: 'Pick at least one audience' }, { status: 400 })
  const sendEmailCh = !!channels?.email
  const sendSmsCh = !!channels?.sms
  if (!sendEmailCh && !sendSmsCh) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 })
  if (!message || !message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (sendEmailCh && (!subject || !subject.trim())) return NextResponse.json({ error: 'Email subject is required' }, { status: 400 })

  const { data: users } = await svc.from('dd_users')
    .select('email, phone, is_active')
    .in('role', rolesForGroups(selected))
  const recipients = (users || []).filter(u => u.is_active !== false)

  const result: { recipients: number; email?: { sent: number; failed: number }; sms?: { sent: number; failed: number } } = {
    recipients: recipients.length,
  }

  if (sendEmailCh) {
    const html = broadcastEmailHtml(subject!, message)
    const targets = recipients.filter(u => u.email)
    result.email = await inChunks(targets, 10, u => sendEmail(u.email as string, subject!, html))
  }
  if (sendSmsCh) {
    const targets = recipients.filter(u => u.phone)
    result.sms = await inChunks(targets, 10, u => sendSMS(u.phone as string, message).then(r => !!r))
  }

  return NextResponse.json({ success: true, ...result })
}
