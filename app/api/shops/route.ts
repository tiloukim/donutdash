import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { haversineDistance } from '@/lib/osrm'
import { AVERAGE_PREP_TIME_MINUTES, AVERAGE_SPEED_MPH } from '@/lib/constants'
import { getSurgeMultiplier, getShopBusyness } from '@/lib/surge'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const customerLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const customerLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null

    let query = supabase
      .from('dd_shops')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false })

    if (slug) {
      query = query.eq('slug', slug)
    }

    const { data: shops, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch live avg ratings from dd_reviews
    const shopIds = (shops || []).map(s => s.id)
    let reviewStats: Record<string, { avg_rating: number; review_count: number }> = {}
    if (shopIds.length > 0) {
      try {
        const { data: reviews } = await supabase
          .from('dd_reviews')
          .select('shop_id, shop_rating')
          .in('shop_id', shopIds)

        if (reviews && reviews.length > 0) {
          const grouped: Record<string, number[]> = {}
          for (const r of reviews) {
            if (!grouped[r.shop_id]) grouped[r.shop_id] = []
            grouped[r.shop_id].push(r.shop_rating)
          }
          for (const [shopId, ratings] of Object.entries(grouped)) {
            const sum = ratings.reduce((a, b) => a + b, 0)
            reviewStats[shopId] = {
              avg_rating: Math.round((sum / ratings.length) * 10) / 10,
              review_count: ratings.length,
            }
          }
        }
      } catch {
        // dd_reviews table may not exist yet - ignore
      }
    }

    // Fetch surge status and shop busyness in parallel
    const [surge, busynessMap] = await Promise.all([
      getSurgeMultiplier(),
      getShopBusyness(shopIds),
    ])

    const shopsWithEta = (shops || []).map(shop => {
      let estimated_delivery_min: number
      let estimated_delivery_max: number
      let distance_miles: number | null = null

      if (customerLat && customerLng && shop.lat && shop.lng) {
        const distanceMiles = haversineDistance(customerLat, customerLng, shop.lat, shop.lng)
        distance_miles = Math.round(distanceMiles * 10) / 10
        const driveTimeMinutes = (distanceMiles / AVERAGE_SPEED_MPH) * 60
        estimated_delivery_min = Math.floor(AVERAGE_PREP_TIME_MINUTES + driveTimeMinutes)
        estimated_delivery_max = estimated_delivery_min + 10
      } else {
        // Default range when location is unknown
        estimated_delivery_min = 20
        estimated_delivery_max = 35
      }

      // Use live review stats if available, otherwise fall back to dd_shops fields
      const stats = reviewStats[shop.id]
      const avg_rating = stats ? stats.avg_rating : shop.rating
      const review_count = stats ? stats.review_count : shop.review_count

      return {
        ...shop,
        estimated_delivery_min,
        estimated_delivery_max,
        distance_miles,
        avg_rating,
        review_count,
        is_busy: busynessMap[shop.id] || false,
        is_claimed: shop.is_claimed ?? true,
      }
    })

    return NextResponse.json({
      shops: shopsWithEta,
      surge_active: surge.isActive,
      surge_multiplier: surge.multiplier,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
