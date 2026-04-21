import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { confirmation } = await req.json()
  if (confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json({ error: 'Please type "DELETE MY ACCOUNT" to confirm.' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Get dd_user
  const { data: ddUser } = await svc.from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (ddUser) {
    // Delete user's orders (set customer to null or anonymize)
    await svc.from('dd_orders')
      .update({ customer_id: null, delivery_address: 'DELETED', delivery_city: '', delivery_state: '', delivery_zip: '' })
      .eq('customer_id', ddUser.id)

    // Delete user's reviews
    await svc.from('dd_reviews').delete().eq('user_id', ddUser.id)

    // Delete user's favorites
    await svc.from('dd_favorites').delete().eq('user_id', ddUser.id)

    // Delete daily usage
    await svc.from('dd_daily_usage').delete().eq('user_id', ddUser.id)

    // Delete pageviews
    await svc.from('dd_pageviews').delete().eq('user_id', ddUser.id)

    // If driver, delete driver documents
    if (ddUser.role === 'driver') {
      await svc.from('dd_driver_documents').delete().eq('driver_id', ddUser.id)
    }

    // Delete the dd_users record
    await svc.from('dd_users').delete().eq('id', ddUser.id)
  }

  // Delete the Supabase auth user
  const { error } = await svc.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Failed to delete auth user:', error)
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
