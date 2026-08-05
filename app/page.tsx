'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ShopCard from '@/components/ShopCard'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import type { Shop } from '@/lib/types'
import DonutIcon from '@/components/DonutIcon'
import RunningDonut from '@/components/RunningDonut'

function PromoBannerCarousel({ banners }: { banners: { title: string; subtitle: string; bg: string; emoji?: string; icon?: React.ReactNode }[] }) {
  const [active, setActive] = useState(0)
  const touchStartX = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % banners.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [banners.length])

  return (
    <div style={{ padding: '0 20px', marginBottom: '24px' }}>
      <div
        style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', height: '120px' }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (Math.abs(diff) > 50) {
            setActive(prev => diff > 0 ? (prev + 1) % banners.length : (prev - 1 + banners.length) % banners.length)
          }
        }}
      >
        {banners.map((promo, i) => (
          <div key={i} style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            background: promo.bg,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: i === active ? 1 : 0,
            transform: i === active ? 'translateX(0)' : i > active ? 'translateX(40px)' : 'translateX(-40px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            pointerEvents: i === active ? 'auto' : 'none',
          }}>
            <span style={{
              position: 'absolute', right: '8px', bottom: '4px',
              fontSize: '3rem', opacity: promo.icon ? 0.9 : 0.3,
            }}>
              {promo.icon || promo.emoji}
            </span>
            <h3 style={{
              color: 'white', fontSize: '1.2rem', fontWeight: 800,
              margin: '0 0 4px', position: 'relative', zIndex: 1,
            }}>
              {promo.title}
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem',
              margin: 0, position: 'relative', zIndex: 1,
            }}>
              {promo.subtitle}
            </p>
          </div>
        ))}
      </div>
      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              width: i === active ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: i === active ? '#FF1493' : '#ddd',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface SearchResult {
  shop: { id: string; name: string; slug: string; image_url: string | null }
  items: { name: string; price: number; image_url: string | null }[]
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const NEAR_ME_RADIUS_MILES = 15
const NEAR_ME_MAX_SHOPS = 6

function StarRating({ rating }: { rating: number }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= Math.round(rating) ? '#FFB800' : '#ddd', fontSize: '0.7rem' }}>
        &#9733;
      </span>
    )
  }
  return <span>{stars}</span>
}

export default function HomePage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [surgeActive, setSurgeActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [itemResults, setItemResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchingItems, setSearchingItems] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { count } = useCart()
  const router = useRouter()
  const [addressInput, setAddressInput] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [isInApp, setIsInApp] = useState(false)

  useEffect(() => {
    // Detect if running inside native app WebView
    const w = window as any
    setIsInApp(!!(w.ReactNativeWebView || navigator.userAgent.includes('DonutDash') || (window as any).webkit?.messageHandlers?.ReactNativeWebView))
  }, [])

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported')
      return
    }
    setGpsStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsStatus('granted')
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }, [])

  const handleAddressSearch = useCallback(async () => {
    const addr = addressInput.trim()
    if (!addr) {
      router.push('/shops')
      return
    }
    setAddressLoading(true)
    setAddressError(null)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`)
      const data = await res.json()
      if (!res.ok) {
        setAddressError(data.error || 'Could not find that address')
        setAddressLoading(false)
        return
      }
      router.push(`/shops?lat=${data.lat}&lng=${data.lng}&sort=nearest&addr=${encodeURIComponent(data.formatted_address || addr)}`)
    } catch {
      setAddressError('Could not find that address')
      setAddressLoading(false)
    }
  }, [addressInput, router])

  // Re-fetch shops whenever we gain (or already have) GPS coordinates so the
  // server can attach distance_miles to every shop.
  useEffect(() => {
    const url = gpsLocation
      ? `/api/shops?lat=${gpsLocation.lat}&lng=${gpsLocation.lng}`
      : '/api/shops'
    fetch(url)
      .then(res => res.json())
      .then(data => {
        // Only show orderable shops on the storefront — hide unclaimed
        // Google-imported listings (is_claimed === false) with no owner to
        // accept or fulfill an order, so customers never hit a dead end.
        setShops((data.shops || []).filter((s: Shop) => s.is_claimed !== false))
        setSurgeActive(data.surge_active || false)
      })
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [gpsLocation])

  // Fetch favorites
  useEffect(() => {
    if (!user) return
    fetch('/api/favorites')
      .then(res => res.json())
      .then(data => setFavoriteIds(new Set(data.favorite_shop_ids || [])))
      .catch(() => {})
  }, [user])

  // Debounced item search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (searchQuery.trim().length < 2) {
      setItemResults([])
      setShowDropdown(false)
      return
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchingItems(true)
      fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(res => res.json())
        .then(data => {
          setItemResults(data.results || [])
          setShowDropdown((data.results || []).length > 0)
        })
        .catch(() => { setItemResults([]); setShowDropdown(false) })
        .finally(() => setSearchingItems(false))
    }, 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleFavorite = useCallback(async (shopId: string) => {
    if (!user) return
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(shopId)) next.delete(shopId); else next.add(shopId)
      return next
    })
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId }),
      })
      const data = await res.json()
      if (res.ok) {
        setFavoriteIds(prev => {
          const next = new Set(prev)
          if (data.favorited) next.add(shopId); else next.delete(shopId)
          return next
        })
      }
    } catch {
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (next.has(shopId)) next.delete(shopId); else next.add(shopId)
        return next
      })
    }
  }, [user])

  const PINK = '#FF1493'
  const ORANGE = '#FF8C00'
  const categories = ['All', 'Donuts', 'Coffee', 'Breakfast']

  // Compute claimed shops within 2 miles of GPS, sorted by distance, top 3
  const nearestShopsGps = (gpsLocation && shops.length > 0)
    ? shops
        .filter(s => s.is_claimed !== false && s.lat != null && s.lng != null)
        .map(s => ({ shop: s, distance: haversineDistance(gpsLocation.lat, gpsLocation.lng, s.lat!, s.lng!) }))
        .filter(x => x.distance <= NEAR_ME_RADIUS_MILES)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, NEAR_ME_MAX_SHOPS)
    : []
  const hasNearestShops = nearestShopsGps.length > 0
  const viewMoreNearestHref = gpsLocation
    ? `/shops?lat=${gpsLocation.lat}&lng=${gpsLocation.lng}&sort=nearest`
    : '/shops'

  // When GPS is available, filter all shops within 2 miles + sort nearest first.
  // Otherwise fall back to first 8 shops in default order.
  const mobileDisplayShops = (gpsLocation && shops.length > 0)
    ? shops
        .filter(s => s.distance_miles != null && s.distance_miles <= NEAR_ME_RADIUS_MILES)
        .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999))
    : shops.slice(0, 8)

  const promoBanners = [
    {
      title: 'EARN Rewards!',
      subtitle: 'Earn points with every order',
      bg: `linear-gradient(135deg, ${PINK}, #FF69B4)`,
      emoji: '🎁',
    },
    {
      title: 'New Kolaches!',
      subtitle: 'Try our fresh breakfast kolaches',
      bg: `linear-gradient(135deg, ${ORANGE}, #FFA500)`,
      emoji: '🔥',
    },
    {
      title: 'Order Online',
      subtitle: 'Fresh donuts to your door',
      bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
      icon: <RunningDonut size={90} />,
    },
  ]

  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': 'https://donutdash.app/#localbusiness',
        name: 'DonutDash',
        description:
          'Donut delivery platform in Tyler, Texas. Order fresh donuts from local shops delivered to your door.',
        url: 'https://donutdash.app',
        image: 'https://donutdash.app/logo.png',
        telephone: '+1-430-999-0168',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Tyler',
          addressRegion: 'TX',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 32.3513,
          longitude: -95.3011,
        },
        areaServed: {
          '@type': 'City',
          name: 'Tyler',
        },
        priceRange: '$',
        servesCuisine: 'Donuts',
      },
      {
        '@type': 'WebSite',
        name: 'DonutDash',
        url: 'https://donutdash.app',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://donutdash.app/shops?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {/* Navbar: hidden on mobile, shown on desktop */}
      <div className="desktop-only">
        <Navbar />
      </div>

      {/* ===== MOBILE APP-STYLE HOME ===== */}
      <div className="mobile-home">
        {/* Status bar spacer for mobile */}
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />

        {/* Greeting + avatar header */}
        <div style={{
          padding: '16px 20px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#1A1A2E',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {user ? `${getGreeting()}, ${user.name.split(' ')[0]}!` : 'Welcome!'}
            </h1>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
              What are you craving today?
            </p>
          </div>
          {user ? (
            <a href="/profile" style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
              cursor: 'pointer',
            }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </a>
          ) : (
            <Link href="/login" style={{
              padding: '8px 16px', background: PINK, color: 'white',
              borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
            }}>
              Sign In
            </Link>
          )}
        </div>

        {/* Delivery address search */}
        <div style={{
          padding: '0 20px',
          marginBottom: '12px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: PINK,
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '6px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={PINK} stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>Deliver to</span>
          </div>
          <div style={{
            display: 'flex',
            background: 'white',
            borderRadius: '12px',
            border: '1.5px solid #FFD4E5',
            overflow: 'hidden',
          }}>
            <input
              type="text"
              placeholder="Enter your delivery address..."
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddressSearch() }}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: '#1A1A2E',
                background: 'transparent',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleAddressSearch}
              disabled={addressLoading}
              style={{
                background: PINK,
                color: 'white',
                padding: '0 16px',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: addressLoading ? 'wait' : 'pointer',
                opacity: addressLoading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {addressLoading ? '…' : 'Find'}
            </button>
          </div>
          {addressError && (
            <p style={{ color: '#D9446C', fontSize: '12px', marginTop: '4px' }}>
              {addressError}
            </p>
          )}
        </div>

        {/* Search bar with item search dropdown */}
        <div style={{ padding: '0 20px', marginBottom: '20px', position: 'relative' }} ref={dropdownRef}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F0F0F0',
            borderRadius: '12px',
            padding: '0 14px',
            gap: '10px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search shops or menu items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (itemResults.length > 0) setShowDropdown(true) }}
              style={{
                flex: 1,
                padding: '12px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.9rem',
                color: '#1A1A2E',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowDropdown(false) }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#999', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Item search dropdown */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '48px',
              left: '20px',
              right: '20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              zIndex: 100,
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #eee',
            }}>
              {searchingItems ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                  Searching...
                </div>
              ) : itemResults.length > 0 ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Menu Items
                  </div>
                  {itemResults.map(group => (
                    group.items.map((item, idx) => (
                      <Link
                        key={`${group.shop.id}-${idx}`}
                        href={`/shops/${group.shop.slug}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        onClick={() => setShowDropdown(false)}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', padding: '10px 14px', gap: '10px', cursor: 'pointer',
                        }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                            background: item.image_url ? `url(${item.image_url}) center/cover no-repeat` : 'linear-gradient(135deg, #FFE4E1, #FFB6C1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                          }}>
                            {!item.image_url && '🍩'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>{group.shop.name}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#FF1493', flexShrink: 0 }}>
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                      </Link>
                    ))
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Surge pricing banner */}
        {surgeActive && (
          <div style={{
            margin: '0 20px 16px',
            padding: '10px 14px',
            background: 'linear-gradient(135deg, #FFA500, #FF8C00)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
              Busy right now — delivery fees are higher than usual
            </span>
          </div>
        )}

        {/* Promo Banners - horizontal scroll */}
        <PromoBannerCarousel banners={promoBanners} />

        {/* Category tabs - horizontal scroll */}
        <div style={{
          padding: '0 20px',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  background: activeCategory === cat ? PINK : '#F0F0F0',
                  color: activeCategory === cat ? 'white' : '#666',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Near Me (GPS-based) — mobile */}
        {gpsStatus !== 'granted' ? (
          <div style={{ padding: '0 20px', marginBottom: '16px' }}>
            <button
              onClick={requestGps}
              disabled={gpsStatus === 'requesting'}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #FFF0F5, #FFE4EC)',
                border: `1.5px solid ${PINK}`,
                borderRadius: '12px',
                color: PINK,
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: gpsStatus === 'requesting' ? 'wait' : 'pointer',
              }}
            >
              <span>📍</span>
              <span>
                {gpsStatus === 'requesting' ? 'Locating you…'
                  : gpsStatus === 'denied' ? 'Location denied — tap to retry'
                  : gpsStatus === 'unsupported' ? 'GPS not supported'
                  : 'Find donut shops within 2 miles of me'}
              </span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '0 20px', marginBottom: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px',
            }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
                📍 Near You ({NEAR_ME_RADIUS_MILES} mi)
              </h2>
            </div>
            {hasNearestShops ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  {nearestShopsGps.map(({ shop, distance }) => (
                    <Link
                      key={shop.id}
                      href={`/shops/${shop.slug}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{
                        background: 'white', borderRadius: '14px', overflow: 'hidden',
                        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                      }}>
                        <div style={{
                          width: '100%', height: '110px',
                          background: shop.image_url
                            ? `url(${shop.image_url}) center/cover no-repeat`
                            : 'linear-gradient(135deg, #FFE4F1 0%, #FFD6E8 50%, #FFC0D9 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {!shop.image_url && <DonutIcon size={80} />}
                        </div>
                        <div style={{ padding: '10px 12px' }}>
                          <h3 style={{
                            fontWeight: 700, fontSize: '0.85rem', margin: 0, color: '#1A1A2E',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {shop.name}
                          </h3>
                          <div style={{ fontSize: '0.7rem', color: PINK, fontWeight: 600, marginTop: '4px' }}>
                            {distance.toFixed(1)} mi away
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={viewMoreNearestHref}
                  style={{
                    display: 'block',
                    marginTop: '12px',
                    textAlign: 'center',
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'white',
                    border: `1.5px solid ${PINK}`,
                    color: PINK,
                    fontWeight: 700,
                    fontSize: '13px',
                    textDecoration: 'none',
                  }}
                >
                  View more nearby shops →
                </Link>
              </>
            ) : (
              <div style={{
                padding: '14px',
                background: '#FFF8FB',
                border: '1px dashed #FFC0D9',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#666',
                textAlign: 'center',
              }}>
                No donut shops within {NEAR_ME_RADIUS_MILES} miles.{' '}
                <Link href={viewMoreNearestHref} style={{ color: PINK, fontWeight: 700 }}>
                  Browse all shops →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Section label */}
        <div style={{
          padding: '0 20px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
            {gpsLocation ? `Shops Within ${NEAR_ME_RADIUS_MILES} Miles` : 'Nearby Shops'}
            {gpsLocation && ` (${mobileDisplayShops.length})`}
          </h2>
          <Link href={viewMoreNearestHref} style={{ color: PINK, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            See All
          </Link>
        </div>

        {/* Shop cards - 2 column grid */}
        <div style={{ padding: '0 20px', paddingBottom: '100px' }}>
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  background: '#f0f0f0',
                  borderRadius: '14px',
                  height: '200px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : mobileDisplayShops.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}>
              {mobileDisplayShops.map(shop => (
                <div key={shop.id} style={{ position: 'relative' }}>
                  <Link
                    href={`/shops/${shop.slug}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      background: 'white',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{
                        width: '100%',
                        height: '110px',
                        background: shop.image_url
                          ? `url(${shop.image_url}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #FFE4F1 0%, #FFD6E8 50%, #FFC0D9 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {!shop.image_url && (
                          <DonutIcon size={80} />
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <h3 style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            margin: 0,
                            color: '#1A1A2E',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {shop.name}
                          </h3>
                          {shop.is_busy && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: '#fff',
                              background: '#F97316',
                              borderRadius: '4px',
                              padding: '1px 5px',
                              flexShrink: 0,
                              lineHeight: '14px',
                            }}>
                              Busy
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginBottom: '4px',
                        }}>
                          <StarRating rating={shop.rating} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1A1A2E' }}>
                            {shop.rating.toFixed(1)}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.7rem',
                          color: '#888',
                          flexWrap: 'wrap',
                        }}>
                          <span>20-35 min</span>
                          {shop.distance_miles != null && (
                            <>
                              <span style={{ color: '#ddd' }}>|</span>
                              <span style={{ color: PINK, fontWeight: 600 }}>
                                📍 {shop.distance_miles.toFixed(1)} mi
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  {/* Heart favorite button */}
                  {user && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(shop.id) }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '30px', height: '30px', borderRadius: '50%', border: 'none',
                        background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 2, padding: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24"
                        fill={favoriteIds.has(shop.id) ? '#FF1493' : 'none'}
                        stroke={favoriteIds.has(shop.id) ? '#FF1493' : '#666'}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem', color: '#888',
            }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🍩</span>
              <p>No shops available yet. Check back soon!</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT (hidden on mobile) ===== */}
      <div className="desktop-only" style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{
          background: 'linear-gradient(180deg, #F9528C 0%, #E94E87 50%, #D8457D 100%)',
          padding: '3rem 1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', position: 'relative', zIndex: 1,
          }}>
            {/* Left: Text + Search */}
            <div style={{ flex: '1 1 400px', textAlign: 'left' }}>
              <h1 style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 800,
                color: 'white',
                marginBottom: '1rem',
                lineHeight: 1.15,
                letterSpacing: '-1px',
              }}>
                {user
                  ? <>{getGreeting()}, {user.name.split(' ')[0]}! <span style={{ display: 'block' }}>Ready for donuts?</span></>
                  : <>Delicious Donuts <span style={{ display: 'block' }}>Delivered Fast</span></>
                }
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                marginBottom: '2rem',
                lineHeight: 1.5,
              }}>
                Fresh donuts, coffee, and breakfast treats from the best local shops, straight to your door.
              </p>

              <div style={{
                display: 'flex',
                maxWidth: '500px',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}>
                <input
                  type="text"
                  placeholder="Enter your delivery address..."
                  value={addressInput}
                  onChange={e => setAddressInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddressSearch() }}
                  style={{
                    flex: 1,
                    padding: '1rem 1.25rem',
                    border: 'none',
                    outline: 'none',
                    fontSize: '1rem',
                    color: '#1A1A2E',
                  }}
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={addressLoading}
                  style={{
                    background: ORANGE,
                    color: 'white',
                    padding: '1rem 1.5rem',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                    border: 'none',
                    cursor: addressLoading ? 'wait' : 'pointer',
                    opacity: addressLoading ? 0.7 : 1,
                  }}
                >
                  {addressLoading ? 'Searching…' : 'Find Shops'}
                </button>
              </div>
              {addressError && (
                <p style={{ color: '#FFE4E1', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {addressError}
                </p>
              )}

              {/* App Download — hide when inside native app */}
              {!isInApp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  <a
                    href="https://apps.apple.com/us/app/donutdash-donut-delivery/id6762573707"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block' }}
                  >
                    <img
                      src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                      alt="Download on the App Store"
                      style={{ height: '44px' }}
                    />
                  </a>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                    Android coming soon
                  </span>
                </div>
              )}
            </div>

            {/* Right: Banner Image */}
            <div style={{ flex: '1 1 350px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: '450px', position: 'relative' }}>
                <img src="/bannerpost.png" alt="DonutDash App" style={{ width: '100%', height: 'auto', display: 'block' }} />
                {/* Fade edges to blend with background */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at center, transparent 50%, #E94E87 95%)',
                }} />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section style={{ padding: '4rem 1.5rem', background: '#FFFAF0' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 700,
              color: '#1A1A2E',
              marginBottom: '0.5rem',
            }}>
              How It Works
            </h2>
            <p style={{ color: '#888', marginBottom: '2.5rem', fontSize: '1rem' }}>
              Getting your favorite donuts is easy
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '2rem',
            }}>
              {[
                { icon: '🔍', title: 'Browse', desc: 'Explore local donut shops and their menus near you' },
                { icon: '🛒', title: 'Order', desc: 'Add your favorites to cart and checkout securely' },
                { icon: '🎉', title: 'Enjoy', desc: 'Sit back and enjoy fresh donuts delivered to your door' },
              ].map((step, i) => (
                <div key={i} style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem', fontSize: '1.75rem',
                  }}>
                    {step.icon}
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#1A1A2E' }}>
                    {step.title}
                  </h3>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Surge pricing banner - desktop */}
        {surgeActive && (
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '1rem 1.5rem 0',
          }}>
            <div style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #FFA500, #FF8C00)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>
                Busy right now — delivery fees are higher than usual
              </span>
            </div>
          </div>
        )}

        {/* Featured Shops */}
        <section style={{ padding: '4rem 1.5rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem',
            }}>
              <div>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: '#1A1A2E' }}>
                  {gpsLocation ? `Shops Within ${NEAR_ME_RADIUS_MILES} Miles` : 'Featured Shops'}
                  {gpsLocation && ` (${mobileDisplayShops.length})`}
                </h2>
                <p style={{ color: '#888', fontSize: '0.95rem' }}>
                  {gpsLocation ? 'Sorted by nearest to you' : 'Popular donut shops near you'}
                </p>
              </div>
              <Link href={viewMoreNearestHref} style={{
                color: PINK, fontWeight: 600, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                View All &rarr;
              </Link>
            </div>

            {loading ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gridAutoRows: '1fr',
                gap: '1rem',
              }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    background: '#f5f5f5', borderRadius: '14px', height: '280px',
                  }} />
                ))}
              </div>
            ) : mobileDisplayShops.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gridAutoRows: '1fr',
                gap: '1rem',
              }}>
                {mobileDisplayShops.map(shop => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    isFavorited={favoriteIds.has(shop.id)}
                    onToggleFavorite={user ? toggleFavorite : undefined}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center', padding: '3rem', color: '#888',
              }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🍩</span>
                <p>No shops available yet. Check back soon!</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section style={{
          padding: '4rem 1.5rem',
          background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2D44 100%)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            color: 'white',
            marginBottom: '1rem',
          }}>
            Ready for some donuts?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', fontSize: '1rem' }}>
            Browse our selection of local donut shops and order your favorites.
          </p>
          <Link href="/shops" style={{
            display: 'inline-block',
            background: PINK,
            color: 'white',
            padding: '0.9rem 2.5rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '1.05rem',
          }}>
            Browse Shops
          </Link>
        </section>
      </div>

      {/* Footer: hidden on mobile */}
      <div className="desktop-only">
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />

      {/* Responsive CSS */}
      <style>{`
        .mobile-home {
          display: block;
        }
        .desktop-only {
          display: none;
        }
        @media (min-width: 769px) {
          .mobile-home {
            display: none;
          }
          .desktop-only {
            display: block;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
