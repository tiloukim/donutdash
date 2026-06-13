import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { MENU_TEMPLATES } from '@/lib/menu-template'

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

  // Load all stored images keyed by (template_id, item_name)
  const { data: imageRows } = await svc.from('dd_menu_template_images').select('template_id, item_name, image_url')
  const imageMap = new Map<string, string>()
  for (const row of imageRows || []) {
    imageMap.set(`${row.template_id}::${row.item_name}`, row.image_url)
  }

  const templates = MENU_TEMPLATES.map(tmpl => ({
    id: tmpl.id,
    name: tmpl.name,
    description: tmpl.description,
    items: tmpl.items.map(item => ({
      name: item.name,
      description: item.description,
      category: item.category,
      image_url: imageMap.get(`${tmpl.id}::${item.name}`) || null,
    })),
  }))

  return NextResponse.json({ templates })
}
