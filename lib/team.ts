// Team members for digital business cards.
// Source of truth is the dd_team_members table — admin manages entries at
// /admin/team. The card page lives at /card/[slug].

import { createServiceClient } from '@/lib/supabase/server'

export interface TeamMember {
  id?: string
  slug: string
  name: string
  title: string
  phone: string
  email: string
  location: string
  photo_url?: string | null
  is_active?: boolean
  display_order?: number
}

export async function getTeamMember(slug: string): Promise<TeamMember | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('dd_team_members')
    .select('*')
    .ilike('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data as TeamMember | null
}

export async function getAllTeamMembers(opts: { activeOnly?: boolean } = {}): Promise<TeamMember[]> {
  const svc = createServiceClient()
  let q = svc.from('dd_team_members').select('*').order('display_order').order('created_at')
  if (opts.activeOnly) q = q.eq('is_active', true)
  const { data } = await q
  return (data || []) as TeamMember[]
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return phone
}
