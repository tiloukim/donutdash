import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify the order exists and belongs to this customer
  const { data: order } = await svc
    .from('dd_orders')
    .select('id, customer_id, status, shop_id, driver_id')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.customer_id !== ddUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.status !== 'delivered') return NextResponse.json({ error: 'Order must be delivered before reviewing' }, { status: 400 })

  const body = await req.json()
  const { shop_rating, driver_rating, comment } = body

  // Validate ratings
  if (!shop_rating || shop_rating < 1 || shop_rating > 5) {
    return NextResponse.json({ error: 'Shop rating must be between 1 and 5' }, { status: 400 })
  }
  if (!driver_rating || driver_rating < 1 || driver_rating > 5) {
    return NextResponse.json({ error: 'Driver rating must be between 1 and 5' }, { status: 400 })
  }

  try {
    // Try to upsert into dd_reviews table
    const { data: review, error } = await svc
      .from('dd_reviews')
      .upsert({
        order_id: id,
        customer_id: ddUser.id,
        shop_id: order.shop_id,
        driver_id: order.driver_id,
        shop_rating: Math.round(shop_rating),
        driver_rating: Math.round(driver_rating),
        comment: comment?.trim() || null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'order_id' })
      .select()
      .single()

    if (error) {
      // Table might not exist yet - return success silently
      console.error('[REVIEW] Failed to save review:', error.message)
      return NextResponse.json({
        success: true,
        review: {
          order_id: id,
          shop_rating: Math.round(shop_rating),
          driver_rating: Math.round(driver_rating),
          comment: comment?.trim() || null,
        },
        persisted: false,
      })
    }

    return NextResponse.json({ success: true, review, persisted: true })
  } catch (err) {
    console.error('[REVIEW] Unexpected error:', err)
    return NextResponse.json({
      success: true,
      review: {
        order_id: id,
        shop_rating: Math.round(shop_rating),
        driver_rating: Math.round(driver_rating),
        comment: comment?.trim() || null,
      },
      persisted: false,
    })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { data: review, error } = await svc
      .from('dd_reviews')
      .select('*')
      .eq('order_id', id)
      .maybeSingle()

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ review: null })
    }

    return NextResponse.json({ review })
  } catch {
    return NextResponse.json({ review: null })
  }
}
