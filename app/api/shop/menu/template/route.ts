import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MENU_TEMPLATES, getTemplate } from '@/lib/menu-template'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

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

type SnapshotItem = {
  name: string
  description: string | null
  price: number
  category: string
  is_available: boolean
  is_featured: boolean
  sort_order: number | null
  image_url: string | null
  images: unknown
  variants: unknown
  prep_time_min: number | null
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

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  let templateId = MENU_TEMPLATES[0].id
  let replace = false
  // 'restore' = use saved snapshot for the target template if one exists
  // 'fresh'   = start clean from the template definition
  // undefined = if a snapshot exists, return 409 so UI can ask the user
  let restoreMode: 'restore' | 'fresh' | undefined
  try {
    const body = await req.json()
    if (body?.template_id && typeof body.template_id === 'string') templateId = body.template_id
    if (body?.replace === true) replace = true
    if (body?.restore_mode === 'restore' || body?.restore_mode === 'fresh') restoreMode = body.restore_mode
  } catch { /* empty body — use defaults */ }

  const template = getTemplate(templateId)
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${templateId}` }, { status: 400 })
  }

  // If menu has items, require an explicit `replace: true` to overwrite.
  const { data: existing } = await svc.from('dd_menu_items').select('*').eq('shop_id', shop.id)
  const existingCount = existing?.length || 0

  if (existingCount > 0 && !replace) {
    return NextResponse.json(
      { error: 'Menu already has items. Pass replace=true to overwrite.', existing_count: existingCount },
      { status: 409 },
    )
  }

  // Snapshot the current menu under the OUTGOING template id so it can be
  // restored later. Skip items already archived from a prior switch.
  if (replace && shop.current_template_id && existing && existing.length > 0) {
    const snapshotItems: SnapshotItem[] = existing
      .filter((i: any) => !(i.name || '').startsWith('[ARCHIVED]'))
      .map((i: any) => ({
        name: i.name,
        description: i.description ?? null,
        price: Number(i.price) || 0,
        category: i.category,
        is_available: !!i.is_available,
        is_featured: !!i.is_featured,
        sort_order: i.sort_order ?? null,
        image_url: i.image_url ?? null,
        images: i.images ?? null,
        variants: i.variants ?? null,
        prep_time_min: i.prep_time_min ?? null,
      }))
    if (snapshotItems.length > 0) {
      await svc.from('dd_menu_snapshots').upsert({
        shop_id: shop.id,
        template_id: shop.current_template_id,
        items_json: snapshotItems,
        saved_at: new Date().toISOString(),
      }, { onConflict: 'shop_id,template_id' })
    }
  }

  // If switching with replace and not told what to do, look for a snapshot
  // of the TARGET template and let the client decide.
  if (replace && restoreMode === undefined) {
    const { data: snap } = await svc
      .from('dd_menu_snapshots')
      .select('saved_at, items_json')
      .eq('shop_id', shop.id)
      .eq('template_id', template.id)
      .maybeSingle()
    if (snap) {
      const itemCount = Array.isArray(snap.items_json) ? snap.items_json.length : 0
      return NextResponse.json({
        snapshot_available: true,
        template_id: template.id,
        saved_at: snap.saved_at,
        item_count: itemCount,
        message: 'A saved version of this template exists for this shop.',
      }, { status: 409 })
    }
  }

  // Wipe existing items. Items with FK references (past orders) get
  // soft-deleted (hidden + renamed) instead of hard-deleted.
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

  let inserted: any[] = []

  if (restoreMode === 'restore') {
    const { data: snap } = await svc
      .from('dd_menu_snapshots')
      .select('items_json')
      .eq('shop_id', shop.id)
      .eq('template_id', template.id)
      .maybeSingle()
    const snapItems = (snap?.items_json || []) as SnapshotItem[]
    inserted = snapItems.map(i => ({
      shop_id: shop.id,
      name: i.name,
      description: i.description,
      price: i.price,
      category: i.category,
      is_available: i.is_available,
      is_featured: i.is_featured,
      sort_order: i.sort_order,
      image_url: i.image_url,
      images: i.images,
      variants: i.variants,
      prep_time_min: i.prep_time_min,
    }))
  } else {
    // Pull stored admin-uploaded images for this template's items
    const { data: imageRows } = await svc
      .from('dd_menu_template_images')
      .select('item_name, image_url')
      .eq('template_id', template.id)
    const imageMap = new Map<string, string>()
    for (const row of imageRows || []) imageMap.set(row.item_name, row.image_url)

    inserted = template.items.map(item => {
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
  }

  const { error } = await svc.from('dd_menu_items').insert(inserted)
  if (error) {
    console.error('Failed to load menu template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mark the shop's current template
  await svc.from('dd_shops').update({ current_template_id: template.id }).eq('id', shop.id)

  return NextResponse.json({
    success: true,
    template_id: template.id,
    count: inserted.length,
    restored: restoreMode === 'restore',
    ...(replace ? { hard_deleted: hardDeleted, soft_deleted: softDeleted } : {}),
  })
}
