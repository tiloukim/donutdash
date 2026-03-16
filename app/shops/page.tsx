'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ShopCard from '@/components/ShopCard'
import type { Shop } from '@/lib/types'

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shops')
      .then(res => res.json())
      .then(data => setShops(data.shops || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 800,
              color: '#1A1A2E',
              marginBottom: '0.35rem',
            }}>
              Browse Donut Shops
            </h1>
            <p style={{ color: '#888', fontSize: '1rem' }}>
              Find the best donuts near you
            </p>
          </div>

          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{
                  background: '#f5f5f5',
                  borderRadius: '14px',
                  height: '280px',
                }} />
              ))}
            </div>
          ) : shops.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}>
              {shops.map(shop => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              color: '#888',
            }}>
              <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🍩</span>
              <h2 style={{ fontWeight: 600, fontSize: '1.3rem', marginBottom: '0.5rem', color: '#1A1A2E' }}>
                No shops available yet
              </h2>
              <p>Check back soon for delicious donut shops!</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
