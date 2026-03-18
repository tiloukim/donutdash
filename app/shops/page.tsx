'use client'

import { useState, useEffect, useMemo } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import ShopCard from '@/components/ShopCard'
import type { Shop } from '@/lib/types'

const categories = ['All', 'Donuts', 'Coffee', 'Breakfast']

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    fetch('/api/shops')
      .then(res => res.json())
      .then(data => setShops(data.shops || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [])

  const filteredShops = useMemo(() => {
    let result = shops
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q))
    }
    // Category filtering could be extended with shop categories in the future
    return result
  }, [shops, search, activeCategory])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Navbar: desktop only */}
      <div className="desktop-only">
        <Navbar />
      </div>

      <main style={{ flex: 1, paddingBottom: '80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>

          {/* Search Bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '0 14px',
              height: '44px',
            }}>
              <span style={{ fontSize: '16px', marginRight: '8px', color: '#999' }}>🔍</span>
              <input
                type="text"
                placeholder="Search donut shops..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  flex: 1,
                  fontSize: '15px',
                  color: '#333',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#999',
                    padding: '0 2px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '12px',
            marginBottom: '8px',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  padding: '8px 18px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeCategory === cat ? '#FF1493' : '#f0f0f0',
                  color: activeCategory === cat ? '#fff' : '#555',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Page Title */}
          <div style={{ marginBottom: '14px' }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#1A1A2E',
              margin: 0,
            }}>
              Browse Donut Shops
            </h1>
            <p style={{ color: '#999', fontSize: '13px', margin: '4px 0 0' }}>
              Find the best donuts near you
            </p>
          </div>

          {/* Global styles for responsive layout */}
          <style>{`
            .shops-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            @media (min-width: 768px) {
              .shops-grid { grid-template-columns: repeat(3, 1fr) !important; }
            }
            @media (min-width: 1024px) {
              .shops-grid { grid-template-columns: repeat(4, 1fr) !important; }
            }
            .desktop-only { display: block; }
            .mobile-only { display: none; }
            @media (max-width: 768px) {
              .desktop-only { display: none !important; }
              .mobile-only { display: flex !important; }
            }
          `}</style>

          {/* Shop Grid */}
          {loading ? (
            <div className="shops-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  background: '#f5f5f5',
                  borderRadius: '12px',
                  aspectRatio: '1',
                }} />
              ))}
            </div>
          ) : filteredShops.length > 0 ? (
            <div className="shops-grid">
              {filteredShops.map(shop => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#888',
            }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>🍩</span>
              <h2 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                {search ? 'No shops found' : 'No shops available yet'}
              </h2>
              <p style={{ fontSize: '14px' }}>
                {search ? 'Try a different search term' : 'Check back soon for delicious donut shops!'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer: desktop only */}
      <div className="desktop-only">
        <Footer />
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  )
}
