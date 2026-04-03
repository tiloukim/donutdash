import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { haversineDistance } from '@/lib/osrm'
import { AVERAGE_PREP_TIME_MINUTES, AVERAGE_SPEED_MPH } from '@/lib/constants'

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

    const shopsWithEta = (shops || []).map(shop => {
      let estimated_delivery_min: number
      let estimated_delivery_max: number

      if (customerLat && customerLng && shop.lat && shop.lng) {
        const distanceMiles = haversineDistance(customerLat, customerLng, shop.lat, shop.lng)
        const driveTimeMinutes = (distanceMiles / AVERAGE_SPEED_MPH) * 60
        estimated_delivery_min = Math.floor(AVERAGE_PREP_TIME_MINUTES + driveTimeMinutes)
        estimated_delivery_max = estimated_delivery_min + 10
      } else {
        // Default range when location is unknown
        estimated_delivery_min = 20
        estimated_delivery_max = 35
      }

      return { ...shop, estimated_delivery_min, estimated_delivery_max }
    })

    return NextResponse.json({ shops: shopsWithEta })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
