import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const categoryId = req.nextUrl.searchParams.get('category')

  // Fetch categories
  const { data: categories } = await svc
    .from('dd_supply_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Fetch products with supplier name
  let query = svc
    .from('dd_supply_products')
    .select('*, supplier:dd_suppliers(id, name)')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data: products, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    products: (products || []).map((p: any) => ({
      ...p,
      supplier_name: p.supplier?.name || 'Unknown',
      supplier: undefined,
    })),
    categories: categories || [],
  })
}
