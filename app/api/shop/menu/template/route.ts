import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MENU_TEMPLATES, getTemplate } from '@/lib/menu-template'

// Public list of available templates (no auth required to read).
export async function GET() {
  return NextResponse.json({
    templates: MENU_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      item_count: t.items.length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  let templateId = MENU_TEMPLATES[0].id
  let replace = false
  try {
    const body = await req.json()
    if (body?.template_id && typeof body.template_id === 'string') templateId = body.template_id
    if (body?.replace === true) replace = true
  } catch { /* empty body — use defaults */ }

  const template = getTemplate(templateId)
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${templateId}` }, { status: 400 })
  }

  // If menu has items, require an explicit `replace: true` to overwrite.
  const { data: existing } = await svc.from('dd_menu_items').select('id, name').eq('shop_id', shop.id)
  const existingCount = existing?.length || 0

  if (existingCount > 0 && !replace) {
    return NextResponse.json(
      { error: 'Menu already has items. Pass replace=true to overwrite.', existing_count: existingCount },
      { status: 409 },
    )
  }

  // Wipe existing items if replacing. Some items may have FK references
  // (past orders) — those can't be hard-deleted, so we soft-delete them
  // by renaming + hiding so they don't clash with the new template.
  let softDeleted = 0
  let hardDeleted = 0
  if (replace && existing && existing.length > 0) {
    for (const item of existing) {
      const { error: delErr } = await svc.from('dd_menu_items').delete().eq('id', item.id).eq('shop_id', shop.id)
      if (delErr) {
        const renamed = item.name?.startsWith('[ARCHIVED]') ? item.name : `[ARCHIVED] ${item.name}`
        const { error: updErr } = await svc.from('dd_menu_items')
          .update({ is_available: false, is_featured: false, name: renamed })
          .eq('id', item.id).eq('shop_id', shop.id)
        if (!updErr) softDeleted++
      } else {
        hardDeleted++
      }
    }
  }

  // Pull stored admin-uploaded images for this template's items
  const { data: imageRows } = await svc
    .from('dd_menu_template_images')
    .select('item_name, image_url')
    .eq('template_id', template.id)
  const imageMap = new Map<string, string>()
  for (const row of imageRows || []) imageMap.set(row.item_name, row.image_url)

  const items = template.items.map(item => {
    const imgUrl = imageMap.get(item.name) || null
    return {
      shop_id: shop.id,
      name: item.name,
      description: item.description,
      price: 0,
      category: item.category,
      is_available: false,
      is_featured: item.is_featured,
      sort_order: item.sort_order,
      image_url: imgUrl,
      images: imgUrl ? [imgUrl] : null,
      variants: item.variants
        ? item.variants.map(v => ({ name: v.name, options: v.options.map(o => ({ name: o, price: 0 })) }))
        : null,
    }
  })

  const { error } = await svc.from('dd_menu_items').insert(items)
  if (error) {
    console.error('Failed to load menu template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    template_id: template.id,
    count: items.length,
    ...(replace ? { hard_deleted: hardDeleted, soft_deleted: softDeleted } : {}),
  })
}
