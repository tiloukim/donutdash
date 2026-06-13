// OSRM (Open Source Routing Machine) - free routing service

const OSRM_API = 'https://router.project-osrm.org'

interface RouteResult {
  distance_miles: number
  duration_minutes: number
  polyline: string
}

// router.project-osrm.org is a free demo server — rate-limits and
// 503s under load. Wrap with a 5s timeout + single retry so a slow
// response doesn't stall the caller (callers already fall back to
// haversine when this returns null, which is acceptable for ETAs but
// silently breaks route_polyline). A user-agent is required by some
// public OSRM mirrors per their AUP.
async function fetchOsrm(url: string, attempt = 0): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DonutDash/1.0 (https://donutdash.app)' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.ok) return res
    // 5xx / 429 → retry once after a short backoff
    if ((res.status >= 500 || res.status === 429) && attempt < 1) {
      await new Promise(r => setTimeout(r, 250))
      return fetchOsrm(url, attempt + 1)
    }
    return null
  } catch (err) {
    clearTimeout(timer)
    if (attempt < 1) {
      await new Promise(r => setTimeout(r, 250))
      return fetchOsrm(url, attempt + 1)
    }
    console.warn('OSRM fetch failed after retry:', err)
    return null
  }
}

export async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<RouteResult | null> {
  const res = await fetchOsrm(
    `${OSRM_API}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
  )
  if (!res) return null
  try {
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null

    const route = data.routes[0]
    return {
      distance_miles: route.distance * 0.000621371,
      duration_minutes: route.duration / 60,
      polyline: route.geometry,
    }
  } catch {
    return null
  }
}

export async function getFullDeliveryRoute(
  driverLat: number, driverLng: number,
  shopLat: number, shopLng: number,
  customerLat: number, customerLng: number
): Promise<{ toShop: RouteResult | null; toCustomer: RouteResult | null }> {
  const [toShop, toCustomer] = await Promise.all([
    getRoute(driverLat, driverLng, shopLat, shopLng),
    getRoute(shopLat, shopLng, customerLat, customerLng),
  ])
  return { toShop, toCustomer }
}

// Haversine distance in miles
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Decode OSRM polyline for Leaflet
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)

    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}
