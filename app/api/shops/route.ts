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

      // Blend the base rating on dd_shops (Google or manual) with any local
      // dd_reviews, so a shop with 289 Google reviews + 1 local 5★ doesn't
      // collapse to "5.0 (1)".
      const stats = reviewStats[shop.id]
      const baseRating = typeof shop.rating === 'number' ? shop.rating : 0
      const baseCount = typeof shop.review_count === 'number' ? shop.review_count : 0
      let avg_rating: number
      let review_count: number
      if (stats) {
        const localSum = stats.avg_rating * stats.review_count
        const totalCount = baseCount + stats.review_count
        avg_rating = totalCount > 0
          ? Math.round(((baseRating * baseCount + localSum) / totalCount) * 10) / 10
          : stats.avg_rating
        review_count = totalCount
      } else {
        avg_rating = baseRating
        review_count = baseCount
      }

      // A sponsor is "live" only while flagged and un-expired.
      const sponsored = !!shop.is_sponsored &&
        (!shop.sponsor_expires_at || new Date(shop.sponsor_expires_at) > new Date())

      return {
        ...shop,
        estimated_delivery_min,
        estimated_delivery_max,
        distance_miles,
        avg_rating,
        review_count,
        is_busy: busynessMap[shop.id] || false,
        is_claimed: shop.is_claimed ?? true,
        sponsored,
        sponsor_rank: shop.sponsor_rank ?? 0,
        sponsor_headline: shop.sponsor_headline ?? null,
        sponsor_banner_url: shop.sponsor_banner_url ?? null,
      }
    })

    // Sort. When the customer's location is known, true proximity is what
    // matters, so distance wins WITHIN each group — the nearest orderable shop
    // shows first. (Previously a hardcoded pinned list + sponsored placement
    // overrode distance, so a physically closer shop wasn't shown first.)
    const hasLocation = customerLat != null && customerLng != null
    shopsWithEta.sort((a, b) => {
      // Sponsored shops (paid placement) keep a guaranteed top spot — even on
      // location searches — highest sponsor_rank first.
      if (a.sponsored !== b.sponsored) return a.sponsored ? -1 : 1
      if (a.sponsored && b.sponsored && a.sponsor_rank !== b.sponsor_rank) {
        return b.sponsor_rank - a.sponsor_rank
      }

      // Orderable (claimed) shops rank above unclaimed "claimable" listings —
      // customers can't order from unclaimed shops.
      const aClaimed = a.is_claimed !== false
      const bClaimed = b.is_claimed !== false
      if (aClaimed !== bClaimed) return aClaimed ? -1 : 1

      // Within the same tier: nearest first when location is known, then rating.
      if (hasLocation) {
        const aDist = a.distance_miles ?? 9999
        const bDist = b.distance_miles ?? 9999
        if (aDist !== bDist) return aDist - bDist
      }
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0)
    })

    // Never expose owner PII / financial internals on this public endpoint.
    const SENSITIVE = ['owner_id', 'tax_id', 'commission_pct', 'owner_pin_hash', 'owner_pin_salt', 'owner_pin_failed_attempts', 'owner_pin_locked_until']
    const publicShops = shopsWithEta.map(s => {
      const c = { ...s } as Record<string, unknown>
      for (const k of SENSITIVE) delete c[k]
      return c
    })

    return NextResponse.json({
      shops: publicShops,
      surge_active: surge.isActive,
      surge_multiplier: surge.multiplier,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
