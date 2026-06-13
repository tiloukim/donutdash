import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { invalidateIvrCache, TTS_VOICE_OPTIONS } from '@/lib/ivr-settings'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (!canAccessAdminPortal(ddUser.role))) return null
  return svc
}

export async function GET() {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await svc.from('dd_ivr_settings').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export async function PUT(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.forward_number !== undefined) {
    const normalized = normalizePhone(String(body.forward_number))
    if (!normalized) return NextResponse.json({ error: 'Invalid phone number — use 10-digit or E.164 format' }, { status: 400 })
    updates.forward_number = normalized
  }
  // Per-option overrides — empty string clears the override; otherwise normalize.
  for (const digit of ['0', '2', '3', '4'] as const) {
    const key = `forward_number_${digit}`
    const raw = (body as Record<string, unknown>)[key]
    if (raw !== undefined) {
      const s = String(raw).trim()
      if (s === '') {
        updates[key] = null
      } else {
        const normalized = normalizePhone(s)
        if (!normalized) return NextResponse.json({ error: `Invalid number for option ${digit}` }, { status: 400 })
        updates[key] = normalized
      }
    }
  }
  if (body.business_hours_start !== undefined) {
    const n = parseInt(String(body.business_hours_start), 10)
    if (Number.isNaN(n) || n < 0 || n > 23) return NextResponse.json({ error: 'business_hours_start must be 0-23' }, { status: 400 })
    updates.business_hours_start = n
  }
  if (body.business_hours_end !== undefined) {
    const n = parseInt(String(body.business_hours_end), 10)
    if (Number.isNaN(n) || n < 1 || n > 24) return NextResponse.json({ error: 'business_hours_end must be 1-24' }, { status: 400 })
    updates.business_hours_end = n
  }
  if (body.dial_timeout_seconds !== undefined) {
    const n = parseInt(String(body.dial_timeout_seconds), 10)
    if (Number.isNaN(n) || n < 5 || n > 60) return NextResponse.json({ error: 'dial_timeout_seconds must be 5-60' }, { status: 400 })
    updates.dial_timeout_seconds = n
  }
  if (body.tts_voice !== undefined) {
    const v = String(body.tts_voice).trim()
    const allowed = TTS_VOICE_OPTIONS.map(o => o.value as string)
    if (!allowed.includes(v)) return NextResponse.json({ error: 'Unsupported voice' }, { status: 400 })
    updates.tts_voice = v
  }
  for (const field of ['greeting', 'option_label_0', 'option_label_2', 'option_label_3', 'option_label_4', 'voicemail_prompt'] as const) {
    const raw = (body as Record<string, unknown>)[field]
    if (raw !== undefined) {
      const s = String(raw).trim()
      if (s.length > 500) return NextResponse.json({ error: `${field} must be 500 chars or fewer` }, { status: 400 })
      updates[field] = s === '' ? null : s
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  // Sanity: end must be after start
  const { data: current } = await svc.from('dd_ivr_settings').select('*').eq('id', 1).maybeSingle()
  const finalStart = (updates.business_hours_start as number | undefined) ?? current?.business_hours_start ?? 7
  const finalEnd = (updates.business_hours_end as number | undefined) ?? current?.business_hours_end ?? 17
  if (finalEnd <= finalStart) {
    return NextResponse.json({ error: 'business_hours_end must be after business_hours_start' }, { status: 400 })
  }

  const { data, error } = await svc.from('dd_ivr_settings').update(updates).eq('id', 1).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateIvrCache()
  return NextResponse.json({ settings: data })
}
