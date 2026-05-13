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

  // Resolve the requested template. Default to the first one (classic) for
  // older clients that POST with no body.
  let templateId = MENU_TEMPLATES[0].id
  try {
    const body = await req.json()
    if (body?.template_id && typeof body.template_id === 'string') templateId = body.template_id
  } catch { /* empty body — use default */ }

  const template = getTemplate(templateId)
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${templateId}` }, { status: 400 })
  }

  // Refuse to load onto a non-empty menu — protects against accidental overwrite.
  const { count } = await svc.from('dd_menu_items').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)
  if (count && count > 0) {
    return NextResponse.json({ error: 'Your menu already has items. Delete existing items first or add items manually.' }, { status: 400 })
  }

  const items = template.items.map(item => ({
    shop_id: shop.id,
    name: item.name,
    description: item.description,
    price: 0,
    category: item.category,
    is_available: false,
    is_featured: item.is_featured,
    sort_order: item.sort_order,
    variants: item.variants
      ? item.variants.map(v => ({ name: v.name, options: v.options.map(o => ({ name: o, price: 0 })) }))
      : null,
  }))

  const { error } = await svc.from('dd_menu_items').insert(items)
  if (error) {
    console.error('Failed to load menu template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template_id: template.id, count: items.length })
}
