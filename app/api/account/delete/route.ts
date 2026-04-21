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
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (ddUser) {
    // If driver, archive tax data before deletion (IRS 4-year retention)
    if (ddUser.role === 'driver' && ddUser.w9_tax_id) {
      // Calculate total earnings
      const { data: earnings } = await svc.from('dd_orders')
        .select('driver_payout, created_at')
        .eq('driver_id', ddUser.id)
        .not('driver_payout', 'is', null)

      const currentYear = new Date().getFullYear()
      const totalEarnings = (earnings || []).reduce((sum, o) => sum + (Number(o.driver_payout) || 0), 0)
      const totalDeliveries = (earnings || []).length

      await svc.from('dd_tax_archive').insert({
        original_user_id: ddUser.id,
        legal_name: ddUser.w9_legal_name,
        business_name: ddUser.w9_business_name,
        tax_classification: ddUser.w9_tax_classification,
        w9_address: ddUser.w9_address,
        w9_city: ddUser.w9_city,
        w9_state: ddUser.w9_state,
        w9_zip: ddUser.w9_zip,
        tax_id_type: ddUser.w9_tax_id_type,
        tax_id: ddUser.w9_tax_id,
        w9_submitted_at: ddUser.w9_submitted_at,
        total_earnings: totalEarnings,
        total_deliveries: totalDeliveries,
        earnings_year: currentYear,
        retain_until: new Date(currentYear + 4, 11, 31).toISOString(),
      })

      // Delete driver documents
      await svc.from('dd_driver_documents').delete().eq('driver_id', ddUser.id)
    }

    // Anonymize orders (keep order records for shop accounting)
    await svc.from('dd_orders')
      .update({ customer_id: null, delivery_address: 'DELETED', delivery_city: '', delivery_state: '', delivery_zip: '' })
      .eq('customer_id', ddUser.id)

    // Also anonymize driver assignment on orders
    if (ddUser.role === 'driver') {
      await svc.from('dd_orders')
        .update({ driver_id: null })
        .eq('driver_id', ddUser.id)
    }

    // Delete user's reviews
    await svc.from('dd_reviews').delete().eq('user_id', ddUser.id)

    // Delete user's favorites
    await svc.from('dd_favorites').delete().eq('user_id', ddUser.id)

    // Delete daily usage
    await svc.from('dd_daily_usage').delete().eq('user_id', ddUser.id)

    // Delete pageviews
    await svc.from('dd_pageviews').delete().eq('user_id', ddUser.id)

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
