'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MenuItemCard from '@/components/MenuItemCard'
import { useCart } from '@/lib/cart-context'
import type { Shop, MenuItem } from '@/lib/types'

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'donuts', label: 'Donuts' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'other', label: 'Other' },
]

export default function ShopDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const { items, total, count, shopId } = useCart()

  const [shop, setShop] = useState<Shop | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(true)
  const [shopOpen, setShopOpen] = useState<{ open: boolean; message: string } | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/shops?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        const s = data.shops?.[0] || data.shop || null
        setShop(s)
        if (s) {
          setMenuLoading(true)
          fetch(`/api/shops/${s.id}/menu`)
            .then(res => res.json())
            .then(menuData => setMenuItems(menuData.items || []))
            .catch(() => setMenuItems([]))
            .finally(() => setMenuLoading(false))
          // Check shop hours
          fetch(`/api/shops/${s.id}/hours`)
            .then(res => res.json())
            .then(status => setShopOpen(status))
            .catch(() => setShopOpen({ open: true, message: 'Open' }))
        }
      })
      .catch(() => setShop(null))
      .finally(() => setLoading(false))
  }, [slug])

  const filteredItems = selectedCategory === 'all'
    ? menuItems.filter(i => i.is_available)
    : menuItems.filter(i => i.is_available && i.category === selectedCategory)

  const showCartBar = count > 0 && shop && shopId === shop.id

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ height: '250px', background: '#f5f5f5', borderRadius: '14px', marginBottom: '1.5rem' }} />
          <div style={{ height: '24px', width: '200px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '1rem' }} />
          <div style={{ height: '16px', width: '300px', background: '#f5f5f5', borderRadius: '6px' }} />
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>😕</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Shop not found</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>The shop you are looking for does not exist.</p>
          <Link href="/shops" style={{
            background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '10px', fontWeight: 600, display: 'inline-block',
          }}>
            Browse Shops
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Shop Banner */}
      <div style={{
        width: '100%',
        height: '280px',
        background: shop.banner_url
          ? `url(${shop.banner_url}) center/cover no-repeat`
          : 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FFB6C1 100%)',
        display: 'flex',
        alignItems: 'flex-end',
      }}>
        <div style={{
          width: '100%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
          padding: '2rem 1.5rem 1.5rem',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ color: 'white', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, marginBottom: '0.25rem' }}>
              {shop.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>
              <span>&#9733; {shop.rating.toFixed(1)} ({shop.review_count} reviews)</span>
              <span>{shop.address}, {shop.city}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Open/Closed Banner */}
      {shopOpen && !shopOpen.open && (
        <div style={{
          background: '#FEF2F2', borderBottom: '1px solid #FECACA',
          padding: '12px 1.5rem', textAlign: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
            🔴 {shopOpen.message}
          </span>
        </div>
      )}
      {shopOpen && shopOpen.open && (
        <div style={{
          background: '#F0FDF4', borderBottom: '1px solid #BBF7D0',
          padding: '8px 1.5rem', textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
            🟢 {shopOpen.message}
          </span>
        </div>
      )}

      {/* Shop Info Bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        padding: '1rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center',
          fontSize: '0.9rem', color: '#666',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            🚗 ${shop.delivery_fee.toFixed(2)} delivery
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            💰 ${shop.min_order.toFixed(2)} min order
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            🕐 20-35 min
          </span>
        </div>
      </div>

      <main style={{ flex: 1, padding: '2rem 1.5rem', paddingBottom: showCartBar ? '5rem' : '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '20px',
                  border: 'none',
                  background: selectedCategory === cat.key ? '#FF1493' : '#f5f5f5',
                  color: selectedCategory === cat.key ? 'white' : '#666',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          {menuLoading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  background: '#f5f5f5', borderRadius: '12px', height: '240px',
                }} />
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}>
              {filteredItems.map(item => (
                <MenuItemCard key={item.id} item={item} shopId={shop.id} shopName={shop.name} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
              <p>No items available in this category.</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Cart Bar */}
      {showCartBar && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FF1493',
          padding: '1rem 1.5rem',
          zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            maxWidth: '1200px', margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ color: 'white' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                {count} item{count !== 1 ? 's' : ''} in cart
              </span>
              <span style={{ marginLeft: '1rem', opacity: 0.9 }}>
                ${total.toFixed(2)}
              </span>
            </div>
            <Link href="/cart" style={{
              background: 'white',
              color: '#FF1493',
              padding: '0.6rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}>
              View Cart
            </Link>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
