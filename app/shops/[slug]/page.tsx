'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import MenuItemCard from '@/components/MenuItemCard'
import { useCart } from '@/lib/cart-context'
import { trackEngagement } from '@/lib/track'
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
  const router = useRouter()
  const slug = params.slug as string
  const { items, total, count, shopId } = useCart()

  const [shop, setShop] = useState<Shop | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(true)
  const [shopOpen, setShopOpen] = useState<{ open: boolean; message: string } | null>(null)
  const [groupOrderLoading, setGroupOrderLoading] = useState(false)
  const [groupOrderLink, setGroupOrderLink] = useState<string | null>(null)
  const [groupOrderCode, setGroupOrderCode] = useState<string | null>(null)
  const [groupCopied, setGroupCopied] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])

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
          fetch(`/api/shops/${s.id}/reviews`)
            .then(res => res.json())
            .then(d => setReviews(d.reviews || []))
            .catch(() => {})
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

  const handleStartGroupOrder = async () => {
    if (!shop) return
    setGroupOrderLoading(true)
    try {
      const res = await fetch('/api/group-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shop.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setGroupOrderLink(data.shareLink)
        setGroupOrderCode(data.shareCode)
      }
    } catch { /* ignore */ }
    setGroupOrderLoading(false)
  }

  // Fire a single page_view engagement event whenever a shop loads.
  // Server snapshots is_claimed at write time so post-claim aggregations
  // can still surface the pre-activation demand. Tied to shop?.id so we
  // re-fire if the user navigates between shops without unmounting.
  useEffect(() => {
    if (!shop?.id) return
    trackEngagement({ shop_id: shop.id, kind: 'page_view' })
  }, [shop?.id])

  const handleCopyGroupLink = () => {
    if (groupOrderLink) {
      navigator.clipboard.writeText(groupOrderLink).then(() => {
        setGroupCopied(true)
        setTimeout(() => setGroupCopied(false), 2000)
      })
    }
  }

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

      {/* Back button */}
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '10px 1.5rem 0' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 600, color: '#FF8C00',
          }}
        >
          <span style={{ fontSize: 20 }}>&#8249;</span> Back
        </button>
      </div>

      {/* Shop Banner */}
      <div style={{
        width: '100%',
        height: 'clamp(200px, 25vw, 350px)',
        background: shop.banner_url
          ? `url(${shop.banner_url}) center/cover no-repeat`
          : 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FFB6C1 100%)',
        display: 'flex',
        alignItems: 'flex-end',
        position: 'relative',
        overflow: 'hidden',
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
            🕐 20-35 min
          </span>
        </div>
      </div>

      {/* Group Order Section */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        padding: '0.75rem 1.5rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!groupOrderCode ? (
            <button
              onClick={handleStartGroupOrder}
              disabled={groupOrderLoading}
              style={{
                background: 'white',
                color: '#FF1493',
                border: '1.5px solid #FF1493',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: groupOrderLoading ? 'not-allowed' : 'pointer',
                opacity: groupOrderLoading ? 0.6 : 1,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {groupOrderLoading ? 'Creating...' : 'Start Group Order'}
            </button>
          ) : (
            <>
              <span style={{ fontSize: '0.85rem', color: '#333', fontWeight: 500 }}>
                Group order started! Code: <strong style={{ color: '#FF1493' }}>{groupOrderCode}</strong>
              </span>
              <button
                onClick={handleCopyGroupLink}
                style={{
                  background: groupCopied ? '#10B981' : '#FF1493',
                  color: 'white',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {groupCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <Link
                href={`/group-order/${groupOrderCode}`}
                style={{
                  color: '#FF1493',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Open Group Order →
              </Link>
            </>
          )}
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '0.75rem',
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '0.75rem',
            }}>
              {filteredItems.map(item => (
                <MenuItemCard key={item.id} item={item} shopId={shop.id} shopName={shop.name} shopIsUnclaimed={shop.is_claimed === false} dualPricingPct={shop.pricing_mode === 'dual_pricing' && shop.cash_discount_pct ? shop.cash_discount_pct : 0} />
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

      {/* Customer Reviews (local + Google) */}
      {reviews.length > 0 && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '1rem' }}>
            Reviews ({reviews.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.slice(0, 10).map((r: any) => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {r.profile_photo_url ? (
                      <img
                        src={r.profile_photo_url}
                        alt={r.author_name}
                        width={28}
                        height={28}
                        style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                      />
                    ) : null}
                    <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.author_name}
                    </span>
                    <span style={{ color: '#F59E0B', fontSize: 14, flexShrink: 0 }}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                    {r.source === 'google' && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#4285F4',
                        background: '#E8F0FE', padding: '2px 6px', borderRadius: 6, flexShrink: 0,
                      }}>
                        Google
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>
                    {r.relative_time || new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && <p style={{ fontSize: 14, color: '#444', margin: 0, lineHeight: 1.5 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtle claim link for unclaimed shops — visible on all devices */}
      {shop.is_claimed === false && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem 2rem', textAlign: 'center' }}>
          <Link
            href={`/shops/claim/${shop.slug}`}
            onClick={() => trackEngagement({ shop_id: shop.id, kind: 'claim_link_click' })}
            style={{ color: '#aaa', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            Own this business? <span style={{ textDecoration: 'underline' }}>Claim it</span>
          </Link>
        </div>
      )}

    </div>
  )
}
