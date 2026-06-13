import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { getTemplate } from '@/lib/menu-template'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (!canAccessAdminPortal(ddUser.role))) return null
  return svc
}

export async function POST(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { template_id, item_name, image_url } = await req.json()
  if (!template_id || !item_name || !image_url) {
    return NextResponse.json({ error: 'template_id, item_name, image_url required' }, { status: 400 })
  }
  const tmpl = getTemplate(template_id)
  if (!tmpl) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  if (!tmpl.items.some(i => i.name === item_name)) {
    return NextResponse.json({ error: `Item "${item_name}" not in template "${template_id}"` }, { status: 400 })
  }

  const { error } = await svc
    .from('dd_menu_template_images')
    .upsert({ template_id, item_name, image_url, updated_at: new Date().toISOString() }, { onConflict: 'template_id,item_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { template_id, item_name } = await req.json()
  if (!template_id || !item_name) {
    return NextResponse.json({ error: 'template_id and item_name required' }, { status: 400 })
  }
  const { error } = await svc
    .from('dd_menu_template_images')
    .delete()
    .eq('template_id', template_id)
    .eq('item_name', item_name)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
