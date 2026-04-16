import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Geocode an address string to { lat, lng } using Google Geocoding API.
// Used by the landing page "Enter your delivery address" search so /shops
// can sort by distance from the entered address.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Geocoding not configured' }, { status: 500 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }
    const r = data.results[0]
    return NextResponse.json({
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      formatted_address: r.formatted_address,
    })
  } catch (err) {
    console.error('Geocode error:', err)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
  }
}
