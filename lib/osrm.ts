// OSRM (Open Source Routing Machine) - free routing service

const OSRM_API = 'https://router.project-osrm.org'

interface RouteResult {
  distance_miles: number
  duration_minutes: number
  polyline: string
}

export async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<RouteResult | null> {
  try {
    const res = await fetch(
      `${OSRM_API}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
    )
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
