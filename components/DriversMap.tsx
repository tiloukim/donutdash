'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface DriverPin {
  id: string
  name: string
  lat: number
  lng: number
  is_online: boolean
}

interface Props {
  drivers: DriverPin[]
}

export default function DriversMap({ drivers }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const initialFitDone = useRef(false)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    // Center on first driver or default to US center
    const centerLat = drivers[0]?.lat || 39.8283
    const centerLng = drivers[0]?.lng || -98.5795
    const zoom = drivers.length > 0 ? 12 : 4

    mapInstance.current = L.map(mapRef.current).setView([centerLat, centerLng], zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapInstance.current)

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [])

  // Update markers when drivers change
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const currentIds = new Set(drivers.map(d => d.id))
    const bounds: L.LatLngExpression[] = []

    // Remove markers for drivers no longer in the list
    for (const id of Object.keys(markersRef.current)) {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    }

    // Add or update markers
    for (const driver of drivers) {
      if (markersRef.current[driver.id]) {
        // Update existing marker position
        markersRef.current[driver.id].setLatLng([driver.lat, driver.lng])
      } else {
        // Create new marker
        const icon = L.divIcon({
          html: `<div style="
            background: #10B981;
            color: white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">🚗</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          className: '',
        })

        markersRef.current[driver.id] = L.marker([driver.lat, driver.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${driver.name}</b><br/>Online`)
      }
      bounds.push([driver.lat, driver.lng])
    }

    // Only fit bounds on first render, then let user control zoom
    if (!initialFitDone.current && bounds.length > 0) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] })
      } else {
        map.setView(bounds[0] as L.LatLngExpression, 14)
      }
      initialFitDone.current = true
    }
  }, [drivers])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
}
