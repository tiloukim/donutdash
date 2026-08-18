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
import { estimateDeliveryEta, DEFAULT_ETA_LABEL } from '@/lib/eta'
import RunningDonut from '@/components/RunningDonut'

function PromoBannerCarousel({ banners }: { banners: { title: string; subtitle: string; bg: string; emoji?: string; icon?: React.ReactNode; image?: string | null; href?: string; sponsored?: boolean }[] }) {
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
        {banners.map((promo, i) => {
          const Tag = (promo.href ? 'a' : 'div') as 'a'
          return (
          <Tag key={i} href={promo.href} style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            // A sponsor's own banner image (darkened for legible text) takes
            // priority; house promos keep their gradient.
            background: promo.image
              ? `linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0.15)), url(${promo.image}) center/cover no-repeat`
              : promo.bg,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            textDecoration: 'none',
            opacity: i === active ? 1 : 0,
            transform: i === active ? 'translateX(0)' : i > active ? 'translateX(40px)' : 'translateX(-40px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            pointerEvents: i === active ? 'auto' : 'none',
          }}>
            {promo.sponsored && (
              <span style={{
                position: 'absolute', top: 10, left: 12, zIndex: 2,
                fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
                color: '#fff', background: 'rgba(0,0,0,0.4)',
                padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
              }}>
                ⭐ Sponsored
              </span>
            )}
            {!promo.image && (
              <span style={{
                position: 'absolute', right: '8px', bottom: '4px',
                fontSize: '3rem', opacity: promo.icon ? 0.9 : 0.3,
              }}>
                {promo.icon || promo.emoji}
              </span>
            )}
            <h3 style={{
              color: 'white', fontSize: '1.2rem', fontWeight: 800,
              margin: '0 0 4px', position: 'relative', zIndex: 1,
              textShadow: promo.image ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
            }}>
              {promo.title}
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.92)', fontSize: '0.8rem',
              margin: 0, position: 'relative', zIndex: 1,
              textShadow: promo.image ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
            }}>
              {promo.subtitle}
            </p>
          </Tag>
          )
        })}
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

// Brand line-icons — replace generic emoji as section markers so the page
// reads as DonutDash rather than a template.
function LineIcon({ name, color = '#FF1493', size = 28 }: { name: 'browse' | 'order' | 'enjoy' | 'local' | 'fresh' | 'fast'; color?: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'browse': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    case 'order': return <svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
    case 'enjoy':
    case 'fresh': return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
    case 'local': return <svg {...p}><path d="M3.5 9 5 4h14l1.5 5" /><path d="M5 9.5V20h14V9.5" /><path d="M4 9a2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0" /><path d="M10 20v-5h4v5" /></svg>
    case 'fast': return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
  }
}

export default function HomePage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredItems, setFeaturedItems] = useState<{ id: string; name: string; price: number; image_url: string; cutout_url?: string; shop_name: string; shop_slug: string }[]>([])
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
  const [deliverWhen, setDeliverWhen] = useState<'now' | 'schedule'>('now')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle')

  // Keep the hero "Deliver now / Schedule" dropdown in sync with a choice made
  // earlier this session, so it never disagrees with what checkout will do.
  useEffect(() => {
    try {
      const p = sessionStorage.getItem('dd_deliver_when')
      if (p === 'schedule' || p === 'now') setDeliverWhen(p)
    } catch {}
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
        // Marketplace view: show orderable shops AND unclaimed "claimable"
        // listings (rendered by ShopCard as coming-soon / claim cards, so
        // they're discovery, not dead ends). Orderable shops sort first.
        setShops(data.shops || [])
        setSurgeActive(data.surge_active || false)
      })
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [gpsLocation])

  // Featured treats — real, photographed items from orderable shops.
  useEffect(() => {
    fetch('/api/menu/featured')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.items) setFeaturedItems(d.items) })
      .catch(() => {})
  }, [])

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

  // When GPS is available, prefer shops within the near-me radius, sorted
  // nearest first. In a small market nothing may fall inside that radius — in
  // that case fall back to the nearest shops overall rather than showing an
  // empty storefront. Without GPS, show the first 8 in default order.
  const mobileDisplayShops = (gpsLocation && shops.length > 0)
    ? (() => {
        const byDistance = [...shops].sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999))
        const within = byDistance.filter(s => s.distance_miles != null && s.distance_miles <= NEAR_ME_RADIUS_MILES)
        return within.length > 0 ? within : byDistance.slice(0, 8)
      })()
    : shops.slice(0, 8)

  // Live trust stats for the hero — all derived from real shop data, never
  // fabricated. A stat is only shown when it's meaningful.
  const orderableShops = shops.filter(s => s.is_claimed !== false)
  // Clicking a featured item opens the customer's NEAREST active shop (order from
  // the closest one), falling back to the item's own shop when we don't know it.
  const nearestActiveShopSlug: string | null = orderableShops.length
    ? ((gpsLocation
        ? [...orderableShops].sort((a, b) => (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999))[0]?.slug
        : orderableShops[0]?.slug) ?? null)
    : null
  // Real, currently-served markets — derived from active shops, never faked.
  const availableMarkets = [...new Set(
    orderableShops.map(s => [s.city, s.state].filter(Boolean).join(', ')).filter(m => m && !m.toLowerCase().includes('null'))
  )]
  // Hero shows a single neutral delivery-time chip. Shop-count and rating chips
  // were removed — weak social proof for a young marketplace.
  const heroStats: { icon: string; value: string; label: string; gold?: boolean }[] = [
    { icon: '⚡', value: DEFAULT_ETA_LABEL, label: 'to your door' },
  ]

  const houseBanners = [
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

  // Paid front-page placement: live sponsors lead the carousel with their own
  // banner image, tapping through to the shop. House promos fill the rest.
  const sponsorBanners = shops
    .filter(s => s.sponsored)
    .sort((a, b) => (b.sponsor_rank ?? 0) - (a.sponsor_rank ?? 0))
    .map(s => ({
      title: s.name,
      subtitle: s.sponsor_headline || 'Featured shop — order now',
      bg: `linear-gradient(135deg, ${ORANGE}, #FFA500)`,
      image: s.sponsor_banner_url || s.banner_url || s.image_url,
      href: `/shops/${s.slug}`,
      sponsored: true,
    }))

  const promoBanners = [...sponsorBanners, ...houseBanners]

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
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: '1.7rem',
              fontWeight: 800,
              color: '#1A1A2E',
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: '-0.3px',
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

        {/* Live trust stats — light variant */}
        {heroStats.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', padding: '0 20px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {heroStats.map((st, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#FFF0F5', border: '1px solid #FFD4E5',
                borderRadius: '999px', padding: '5px 11px',
              }}>
                <span style={{ fontSize: '0.8rem', color: st.gold ? '#F5A623' : PINK, lineHeight: 1 }}>{st.icon}</span>
                <span style={{ color: '#1A1A2E', fontWeight: 700, fontSize: '0.78rem' }}>{st.value}</span>
                <span style={{ color: '#888', fontSize: '0.72rem' }}>{st.label}</span>
              </div>
            ))}
          </div>
        )}

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

        {/* Featured treats — mobile horizontal scroll */}
        {featuredItems.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ padding: '0 20px', marginBottom: '10px' }}>
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '1.2rem', fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Fresh &amp; popular</h2>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>Donuts, kolaches, cro-nuts &amp; more</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 20px 4px', WebkitOverflowScrolling: 'touch' }}>
              {featuredItems.map(item => (
                <Link key={item.id} href={`/shops/${nearestActiveShopSlug || item.shop_slug}`} style={{ flexShrink: 0, width: '140px', textDecoration: 'none', borderRadius: '14px', overflow: 'hidden', border: '1px solid #F1E3EA', background: '#fff' }}>
                  <div style={{ width: '100%', height: '110px', background: '#FFF7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                    <img
                      src={item.cutout_url || item.image_url}
                      onError={e => { const t = e.currentTarget; if (t.src.includes('item-cutouts')) t.src = item.image_url }}
                      alt={item.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.14))' }}
                    />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

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
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '1.2rem', fontWeight: 800, color: '#1A1A2E', margin: 0 }}>
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
          <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '1.3rem', fontWeight: 800, color: '#1A1A2E', margin: 0 }}>
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
                          <span>{shop.distance_miles != null ? estimateDeliveryEta(shop.distance_miles).label : DEFAULT_ETA_LABEL}</span>
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
        {/* Hero Section — UberEats-style full-bleed search hero.
            TO DROP IN A REAL DONUT PHOTO LATER: replace the section `background`
            with a left-scrim + image, e.g.:
              background: `linear-gradient(100deg, rgba(255,246,238,0.97) 0%, rgba(255,246,238,0.75) 40%, rgba(255,246,238,0) 70%), url(/hero-donuts.jpg) center/cover no-repeat`
            and delete the <HeroDecor> block below. Everything else stays. */}
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(120deg, #D4F0DE 0%, #EAF2E6 22%, #FBDFEC 60%, #F177B0 100%)',
          minHeight: '540px',
          display: 'flex',
          alignItems: 'center',
          padding: '4rem 1.5rem',
        }}>
          {/* Soft warm glow behind the app image */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div style={{ position: 'absolute', left: '-4%', top: '-24%', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,168,102,0.16), rgba(52,168,102,0) 70%)' }} />
            <div style={{ position: 'absolute', right: '4%', bottom: '-28%', width: '560px', height: '560px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,20,147,0.22), rgba(255,20,147,0) 70%)' }} />
          </div>

          <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 480px', minWidth: 0 }}>
              <h1 style={{
                fontFamily: 'var(--font-dm-sans), system-ui, -apple-system, sans-serif',
                fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
                fontWeight: 800,
                color: '#12121C',
                lineHeight: 1.02,
                letterSpacing: '-1.5px',
                margin: '0 0 1rem',
              }}>
                {user
                  ? <>{getGreeting()}, {user.name.split(' ')[0]}.<br />Order donuts near you</>
                  : <>Fresh Donuts.<br />Delivered.</>
                }
              </h1>
              <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: '#3A3A48', lineHeight: 1.5, margin: '0 0 1.75rem', maxWidth: '520px' }}>
                Find local donut shops near you and order fresh donuts, breakfast, coffee, kolaches, and more.
              </p>

              {/* Uber-style search row: address · deliver-when · button */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch', maxWidth: '760px' }}>
                <div style={{
                  flex: '1 1 320px', display: 'flex', alignItems: 'center', gap: '10px', height: '54px',
                  background: '#fff', border: '1px solid #ECECEC', borderRadius: '10px', padding: '0 16px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.09)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#12121C" aria-hidden><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>
                  <input
                    type="text"
                    placeholder="Enter delivery address"
                    value={addressInput}
                    onChange={e => setAddressInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddressSearch() }}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', color: '#12121C', background: 'transparent' }}
                  />
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: '6px', height: '54px', cursor: 'pointer',
                  background: '#fff', border: '1px solid #ECECEC', borderRadius: '10px', padding: '0 12px 0 14px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.09)',
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12121C" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                  <select
                    value={deliverWhen}
                    onChange={e => {
                      const v = e.target.value as 'now' | 'schedule'
                      setDeliverWhen(v)
                      // Carry the choice to checkout (survives shop → cart → checkout nav)
                      try { sessionStorage.setItem('dd_deliver_when', v) } catch {}
                    }}
                    aria-label="When to deliver"
                    style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', fontWeight: 600, color: '#12121C', cursor: 'pointer', paddingRight: '2px' }}
                  >
                    <option value="now">Deliver now</option>
                    <option value="schedule">Schedule</option>
                  </select>
                  <span style={{ color: '#12121C', fontSize: '0.7rem' }}>▾</span>
                </label>

                <button
                  onClick={handleAddressSearch}
                  disabled={addressLoading}
                  style={{
                    height: '54px', background: PINK, color: '#fff', fontWeight: 700, fontSize: '0.98rem',
                    border: 'none', borderRadius: '10px', padding: '0 28px', whiteSpace: 'nowrap',
                    cursor: addressLoading ? 'wait' : 'pointer', opacity: addressLoading ? 0.7 : 1,
                    boxShadow: '0 8px 22px rgba(255,20,147,0.34)',
                  }}
                >
                  {addressLoading ? 'Searching…' : 'Find Donuts'}
                </button>
              </div>

              {addressError && (
                <p style={{ color: '#C0264E', fontSize: '0.85rem', marginTop: '0.6rem' }}>{addressError}</p>
              )}

              <button onClick={requestGps} style={{
                marginTop: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '7px',
                background: '#fff', border: '1px solid #ECECEC', borderRadius: '10px', padding: '10px 16px',
                fontWeight: 700, fontSize: '0.9rem', color: '#12121C', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="8" /><line x1="12" y1="1.5" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22.5" /><line x1="1.5" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22.5" y2="12" /></svg>
                {gpsStatus === 'requesting' ? 'Locating…' : gpsStatus === 'denied' ? 'Location blocked — type your address' : 'Use current location'}
              </button>

              <div style={{ marginTop: '1.1rem', fontSize: '0.95rem', color: '#5A5A68' }}>
                {user
                  ? <>Craving something? <Link href="/shops" style={{ color: '#12121C', fontWeight: 700, textDecoration: 'underline' }}>Browse all shops</Link></>
                  : <>Or <Link href="/login" style={{ color: '#12121C', fontWeight: 700, textDecoration: 'underline' }}>Sign in</Link> to see your saved addresses</>
                }
              </div>

              {/* Live trust stats — light variant */}
              {heroStats.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1.75rem' }}>
                  {heroStats.map((st, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '999px', padding: '6px 13px',
                    }}>
                      <span style={{ fontSize: '0.85rem', color: st.gold ? '#F5A623' : PINK, lineHeight: 1 }}>{st.icon}</span>
                      <span style={{ color: '#12121C', fontWeight: 800, fontSize: '0.85rem' }}>{st.value}</span>
                      <span style={{ color: '#6B6B78', fontSize: '0.8rem' }}>{st.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: DonutDash app images (transparent cut-out, floats on the hero) */}
            <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}>
              <img
                src="/hero-app.png"
                alt="DonutDash app — browse shops, order donuts, and track delivery"
                fetchPriority="high"
                style={{ width: '100%', maxWidth: '480px', height: 'auto', display: 'block', filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.13))' }}
              />
            </div>
          </div>
        </section>


        {/* Popular Categories — the real menu categories (donuts/coffee/breakfast/drinks) */}
        <section style={{ padding: '3.5rem 1.5rem', background: '#FFF9F3' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 1.5rem' }}>
              Browse by category
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              {[
                { key: 'donuts', label: 'Donuts', emoji: '🍩' },
                { key: 'coffee', label: 'Coffee', emoji: '☕' },
                { key: 'breakfast', label: 'Breakfast', emoji: '🥐' },
                { key: 'drinks', label: 'Drinks', emoji: '🥤' },
              ].map(cat => (
                <Link key={cat.key} href={`/shops?category=${cat.key}`} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                  background: '#fff', border: '1px solid #F1E3EA', borderRadius: '16px',
                  padding: '1.5rem 1rem', textDecoration: 'none', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{ fontWeight: 700, color: '#1A1A2E', fontSize: '0.95rem' }}>{cat.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured treats — real, photographed menu items from orderable shops */}
        {featuredItems.length > 0 && (
          <section style={{ padding: '4rem 1.5rem', background: '#fff' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 800, color: '#1A1A2E', margin: 0 }}>
                    Fresh from local donut shops
                  </h2>
                  <p style={{ color: '#888', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
                    Donuts, kolaches, cro-nuts, and more — made fresh daily
                  </p>
                </div>
                <Link href="/shops" style={{ color: PINK, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Order now &rarr;
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                {featuredItems.map(item => (
                  <Link key={item.id} href={`/shops/${nearestActiveShopSlug || item.shop_slug}`} style={{ textDecoration: 'none', display: 'block', borderRadius: '14px', overflow: 'hidden', border: '1px solid #F1E3EA', background: '#fff' }}>
                    <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#FFF7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                      <img
                        src={item.cutout_url || item.image_url}
                        onError={e => { const t = e.currentTarget; if (t.src.includes('item-cutouts')) t.src = item.image_url }}
                        alt={item.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.14))' }}
                      />
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ color: '#9A9AA8', fontSize: '0.72rem', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.shop_name}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Find Donuts Near You */}
        <section style={{ padding: '4rem 1.5rem', background: '#fff' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 0.5rem' }}>
              Find donuts near you
            </h2>
            <p style={{ color: '#888', margin: '0 0 1.5rem' }}>Enter your address, city, or ZIP to see shops that deliver to you.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                type="text"
                placeholder="Address, city, or ZIP"
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddressSearch() }}
                style={{ flex: '1 1 320px', height: '52px', border: '1px solid #E4E4EC', borderRadius: '10px', padding: '0 16px', fontSize: '1rem', color: '#12121C', outline: 'none' }}
              />
              <button onClick={handleAddressSearch} disabled={addressLoading} style={{ height: '52px', background: PINK, color: '#fff', fontWeight: 700, border: 'none', borderRadius: '10px', padding: '0 26px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {addressLoading ? 'Searching…' : 'Search donut shops'}
              </button>
            </div>
            <button onClick={requestGps} style={{ marginTop: '1rem', background: 'none', border: 'none', color: PINK, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              {gpsStatus === 'requesting' ? 'Locating…' : gpsStatus === 'denied' ? 'Location blocked — enter address above' : '📍 Use my location'}
            </button>
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

        {/* Cities / Markets Served — honest: only real active markets are "Available" */}
        <section style={{ padding: '4rem 1.5rem', background: '#FFF7FB' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 0.5rem' }}>
              DonutDash near you
            </h2>
            <p style={{ color: '#888', margin: '0 0 1.75rem' }}>Now delivering in East Texas — with more markets on the way.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {availableMarkets.map(m => (
                <div key={m} style={{ background: '#fff', border: '1px solid #E7F3EA', borderRadius: '14px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{m}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1E9E5A', background: '#E7F7EE', padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' }}>● Available</span>
                </div>
              ))}
              {['Lindale, TX', 'Dallas, TX', 'Houston, TX', 'Austin, TX', 'Phoenix, AZ'].map(m => (
                <div key={m} style={{ background: '#fff', border: '1px solid #ECECEC', borderRadius: '14px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', opacity: 0.75 }}>
                  <span style={{ fontWeight: 700, color: '#77778A' }}>{m}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9A9AA8', background: '#F1F1F4', padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' }}>Coming soon</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why DonutDash */}
        <section style={{ padding: '3.5rem 1.5rem', background: '#fff' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 1.75rem' }}>Why DonutDash</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {[
                { name: 'local' as const, title: 'Made for donut lovers', desc: 'Discover independent donut shops near you, all in one place.' },
                { name: 'fresh' as const, title: 'Fresh morning delivery', desc: 'Order donuts, kolaches, coffee, and breakfast — made that morning.' },
                { name: 'fast' as const, title: 'Support local shops', desc: 'Order directly from local donut businesses in your community.' },
              ].map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, width: '46px', height: '46px', borderRadius: '12px', background: 'linear-gradient(135deg, #FFF0F5, #FFE1EE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LineIcon name={v.name} color={PINK} size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1A1A2E', margin: '0 0 0.25rem' }}>{v.title}</h3>
                    <p style={{ color: '#77778A', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App promotion */}
        <section style={{ padding: '4rem 1.5rem', background: '#FFFAF0' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px' }}>
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 0.75rem' }}>
                Your favorite donut shops, in your pocket
              </h2>
              <p style={{ color: '#77778A', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                Order fresh donuts, track your delivery in real time, and reorder your favorites in a tap.
              </p>
              <a href="https://apps.apple.com/us/app/donutdash-donut-delivery/id6762573707" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" style={{ height: '48px' }} />
              </a>
              <p style={{ color: '#9A9AA8', fontSize: '0.82rem', margin: '0.75rem 0 0' }}>Android coming soon</p>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
              <img src="/hero-app.png" alt="DonutDash mobile app" style={{ width: '100%', maxWidth: '380px', height: 'auto', filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.12))' }} />
            </div>
          </div>
        </section>

        {/* Merchant + Driver + POS */}
        <section style={{ padding: '4.5rem 1.5rem', background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2D44 100%)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ maxWidth: '640px', marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.75rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', margin: '0 0 0.75rem' }}>
                Own a donut shop?
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
                Grow your business with DonutDash — online ordering, local delivery, and our POS in one platform.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', marginBottom: '2rem' }}>
              {['Online ordering', 'Local delivery', 'DonutDash POS', 'Lower delivery fees', 'Customer marketing', 'Order & menu management', 'Reporting'].map(b => (
                <span key={b} style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                  <span style={{ color: '#FF6FB0', fontWeight: 800 }}>✓</span> {b}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/signup?role=shop_owner" style={{ background: PINK, color: '#fff', fontWeight: 700, padding: '0.9rem 2rem', borderRadius: '10px', textDecoration: 'none' }}>Join DonutDash</Link>
              <Link href="/partner-setup" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, padding: '0.9rem 2rem', borderRadius: '10px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)' }}>Learn about DonutDash for Shops</Link>
              <Link href="/signup?role=driver" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, padding: '0.9rem 0.5rem', textDecoration: 'underline' }}>Become a driver</Link>
            </div>
          </div>
        </section>
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
