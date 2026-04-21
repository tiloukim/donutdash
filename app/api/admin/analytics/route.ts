import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'admin' && ddUser.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const range = req.nextUrl.searchParams.get('range') || '7d'
  const now = new Date()
  let since: Date

  switch (range) {
    case '24h': since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
    case '7d': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case '30d': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    case '90d': since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
    default: since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  const sinceISO = since.toISOString()

  // Fetch pageviews
  const { data: views } = await svc.from('dd_pageviews')
    .select('path, city, region, country, latitude, longitude, shop_id, device_type, session_id, created_at')
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(10000)

  const pageviews = views || []

  // Total views & unique sessions
  const totalViews = pageviews.length
  const uniqueSessions = new Set(pageviews.map(v => v.session_id).filter(Boolean)).size

  // Live visitors (last 5 minutes) — broken down by role
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const recentViews = pageviews.filter(v => v.created_at >= fiveMinAgo)

  const liveDriverSessions = new Set<string>()
  const liveShopSessions = new Set<string>()
  const liveCustomerSessions = new Set<string>()
  const liveAllSessions = new Set<string>()

  recentViews.forEach(v => {
    if (!v.session_id) return
    liveAllSessions.add(v.session_id)
    if (v.path.startsWith('/driver')) {
      liveDriverSessions.add(v.session_id)
    } else if (v.path.startsWith('/shop')) {
      liveShopSessions.add(v.session_id)
    } else {
      liveCustomerSessions.add(v.session_id)
    }
  })

  const liveVisitors = liveAllSessions.size
  const liveByRole = {
    customers: liveCustomerSessions.size,
    drivers: liveDriverSessions.size,
    shopOwners: liveShopSessions.size,
  }

  // Views by city (top 20)
  const cityMap: Record<string, { count: number; lat: number | null; lng: number | null; region: string | null; country: string | null }> = {}
  pageviews.forEach(v => {
    if (!v.city) return
    if (!cityMap[v.city]) {
      cityMap[v.city] = { count: 0, lat: v.latitude, lng: v.longitude, region: v.region, country: v.country }
    }
    cityMap[v.city].count++
  })
  const topCities = Object.entries(cityMap)
    .map(([city, data]) => ({ city, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Views by page (top 15)
  const pageMap: Record<string, number> = {}
  pageviews.forEach(v => {
    const p = v.path.split('?')[0] // strip query params
    pageMap[p] = (pageMap[p] || 0) + 1
  })
  const topPages = Object.entries(pageMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Device breakdown
  const devices: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 }
  pageviews.forEach(v => {
    if (v.device_type && devices[v.device_type] !== undefined) devices[v.device_type]++
  })

  // Shop visits (top shops by page views)
  const shopViewMap: Record<string, number> = {}
  pageviews.forEach(v => {
    if (v.shop_id) shopViewMap[v.shop_id] = (shopViewMap[v.shop_id] || 0) + 1
  })

  // Get shop names
  const shopIds = Object.keys(shopViewMap)
  let topShopViews: { shopId: string; name: string; views: number; orders: number }[] = []
  if (shopIds.length > 0) {
    const { data: shops } = await svc.from('dd_shops').select('id, name').in('id', shopIds)
    const { data: shopOrders } = await svc.from('dd_orders')
      .select('shop_id')
      .in('shop_id', shopIds)
      .gte('created_at', sinceISO)
      .neq('status', 'cancelled')

    const orderCountMap: Record<string, number> = {}
    shopOrders?.forEach(o => {
      orderCountMap[o.shop_id] = (orderCountMap[o.shop_id] || 0) + 1
    })

    topShopViews = shopIds.map(id => ({
      shopId: id,
      name: shops?.find(s => s.id === id)?.name || 'Unknown',
      views: shopViewMap[id],
      orders: orderCountMap[id] || 0,
    })).sort((a, b) => b.views - a.views).slice(0, 20)
  }

  // Hourly traffic (for the time range)
  const hourlyMap: Record<string, number> = {}
  pageviews.forEach(v => {
    const hour = v.created_at.slice(0, 13) + ':00' // YYYY-MM-DDTHH:00
    hourlyMap[hour] = (hourlyMap[hour] || 0) + 1
  })
  const hourlyTraffic = Object.entries(hourlyMap)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  // Daily traffic
  const dailyMap: Record<string, number> = {}
  pageviews.forEach(v => {
    const day = v.created_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] || 0) + 1
  })
  const dailyTraffic = Object.entries(dailyMap)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))

  return NextResponse.json({
    totalViews,
    uniqueSessions,
    liveVisitors,
    liveByRole,
    topCities,
    topPages,
    devices,
    topShopViews,
    hourlyTraffic,
    dailyTraffic,
    range,
  })
}
