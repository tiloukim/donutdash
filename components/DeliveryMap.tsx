'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  shopLat: number
  shopLng: number
  customerLat?: number | null
  customerLng?: number | null
  driverLat?: number | null
  driverLng?: number | null
}

export default function DeliveryMap({ shopLat, shopLng, customerLat, customerLng, driverLat, driverLng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<{ shop?: L.Marker; customer?: L.Marker; driver?: L.Marker }>({})

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    mapInstance.current = L.map(mapRef.current).setView([shopLat, shopLng], 14)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapInstance.current)

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [shopLat, shopLng])

  // Update markers
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const bounds: L.LatLngExpression[] = []

    // Shop marker
    if (markersRef.current.shop) markersRef.current.shop.remove()
    const shopIcon = L.divIcon({
      html: '<div style="font-size:24px;text-align:center">🏪</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      className: '',
    })
    markersRef.current.shop = L.marker([shopLat, shopLng], { icon: shopIcon })
      .addTo(map)
      .bindPopup('Pickup Location')
    bounds.push([shopLat, shopLng])

    // Customer marker
    if (customerLat && customerLng) {
      if (markersRef.current.customer) markersRef.current.customer.remove()
      const custIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">📍</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        className: '',
      })
      markersRef.current.customer = L.marker([customerLat, customerLng], { icon: custIcon })
        .addTo(map)
        .bindPopup('Delivery Location')
      bounds.push([customerLat, customerLng])
    }

    // Driver marker
    if (driverLat && driverLng) {
      if (markersRef.current.driver) markersRef.current.driver.remove()
      const driverIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">🚗</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        className: '',
      })
      markersRef.current.driver = L.marker([driverLat, driverLng], { icon: driverIcon })
        .addTo(map)
        .bindPopup('Driver')
      bounds.push([driverLat, driverLng])
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [40, 40] })
    }
  }, [shopLat, shopLng, customerLat, customerLng, driverLat, driverLng])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
}
