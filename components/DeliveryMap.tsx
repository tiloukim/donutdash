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
  driverHeading?: number | null // Compass heading in degrees (0=North, 90=East, etc.)
  followDriver?: boolean // When true, keep map centered on driver
}

export default function DeliveryMap({ shopLat, shopLng, customerLat, customerLng, driverLat, driverLng, driverHeading, followDriver = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<{ shop?: L.Marker; customer?: L.Marker; driver?: L.Marker }>({})
  const initialFitDone = useRef(false)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const initLat = driverLat || shopLat
    const initLng = driverLng || shopLng
    mapInstance.current = L.map(mapRef.current).setView([initLat, initLng], 15)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapInstance.current)

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
      initialFitDone.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Driver marker with heading rotation
    if (driverLat && driverLng) {
      const rotation = driverHeading != null ? driverHeading : 0
      const driverIcon = L.divIcon({
        html: `<div style="
          width:40px;height:40px;
          display:flex;align-items:center;justify-content:center;
          transform:rotate(${rotation}deg);
          transition:transform 0.5s ease;
          filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        ">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
            <path d="M12 2L4 10h3v8h2v-4h6v4h2v-8h3L12 2z" fill="#2563EB" stroke="#1e40af" stroke-width="0.5"/>
            <circle cx="12" cy="6" r="1.5" fill="#93c5fd"/>
          </svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: '',
      })

      if (markersRef.current.driver) {
        markersRef.current.driver.setLatLng([driverLat, driverLng])
        markersRef.current.driver.setIcon(driverIcon)
      } else {
        markersRef.current.driver = L.marker([driverLat, driverLng], { icon: driverIcon })
          .addTo(map)
          .bindPopup('Driver')
      }
      bounds.push([driverLat, driverLng])
    }

    // Center on driver if followDriver is enabled
    if (followDriver && driverLat && driverLng) {
      map.panTo([driverLat, driverLng], { animate: true, duration: 0.5 })
    } else if (!initialFitDone.current && bounds.length > 1) {
      // First render: fit all markers
      map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [40, 40] })
      initialFitDone.current = true
    }
  }, [shopLat, shopLng, customerLat, customerLng, driverLat, driverLng, driverHeading, followDriver])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
}
