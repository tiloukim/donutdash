'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import ShopCard from '@/components/ShopCard'
import { useAuth } from '@/lib/auth-context'
import type { Shop } from '@/lib/types'

const categories = ['All', 'Favorites', 'Donuts', 'Coffee', 'Breakfast']

interface SearchResult {
  shop: { id: string; name: string; slug: string; image_url: string | null }
  items: { name: string; price: number; image_url: string | null }[]
}

type SortOption = 'recommended' | 'fastest' | 'highest_rated' | 'nearest' | 'lowest_fee'

const sortLabels: Record<SortOption, string> = {
  recommended: 'Recommended',
  fastest: 'Fastest Delivery',
  highest_rated: 'Highest Rated',
  nearest: 'Nearest',
  lowest_fee: 'Lowest Delivery Fee',
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function ShopsPage() {
  return (
    <Suspense fallback={null}>
      <ShopsPageInner />
    </Suspense>
  )
}

function ShopsPageInner() {
  const searchParams = useSearchParams()
  const urlLat = searchParams.get('lat')
  const urlLng = searchParams.get('lng')
  const urlSort = searchParams.get('sort') as SortOption | null
  const urlAddr = searchParams.get('addr')

  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [surgeActive, setSurgeActive] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [itemResults, setItemResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchingItems, setSearchingItems] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>(
    urlSort && ['recommended', 'fastest', 'highest_rated', 'nearest', 'lowest_fee'].includes(urlSort)
      ? urlSort
      : 'recommended'
  )
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(
    urlLat && urlLng ? { lat: parseFloat(urlLat), lng: parseFloat(urlLng) } : null
  )
  const { user } = useAuth()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch shops — include lat/lng if we have it so each shop gets distance_miles
  useEffect(() => {
    const url = customerLocation
      ? `/api/shops?lat=${customerLocation.lat}&lng=${customerLocation.lng}`
      : '/api/shops'
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setShops(data.shops || [])
        setSurgeActive(data.surge_active || false)
      })
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [customerLocation])

  // Fetch favorites
  useEffect(() => {
    if (!user) return
    fetch('/api/favorites')
      .then(res => res.json())
      .then(data => {
        setFavoriteIds(new Set(data.favorite_shop_ids || []))
      })
      .catch(() => {})
  }, [user])

  // Debounced item search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (search.trim().length < 2) {
      setItemResults([])
      setShowDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchingItems(true)
      fetch(`/api/search?q=${encodeURIComponent(search.trim())}`)
        .then(res => res.json())
        .then(data => {
          setItemResults(data.results || [])
          setShowDropdown((data.results || []).length > 0)
        })
        .catch(() => {
          setItemResults([])
          setShowDropdown(false)
        })
        .finally(() => setSearchingItems(false))
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [search])

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
    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(shopId)) next.delete(shopId)
      else next.add(shopId)
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
          if (data.favorited) next.add(shopId)
          else next.delete(shopId)
          return next
        })
      }
    } catch {
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (next.has(shopId)) next.delete(shopId)
        else next.add(shopId)
        return next
      })
    }
  }, [user])

  // Request geolocation when "Nearest" sort is selected
  useEffect(() => {
    if (sortBy === 'nearest' && !customerLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCustomerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fail
      )
    }
  }, [sortBy, customerLocation])

  const filteredShops = useMemo(() => {
    let result = shops
    if (activeCategory === 'Favorites') {
      result = result.filter(s => favoriteIds.has(s.id))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q))
    }

    // When location is known, only show shops within 30 miles (service area)
    if (customerLocation) {
      result = result.filter(s => {
        if (s.distance_miles != null) return s.distance_miles <= 50
        if (s.lat && s.lng) return haversineDistance(customerLocation.lat, customerLocation.lng, s.lat, s.lng) <= 50
        return true
      })
    }

    // Apply sorting
    result = [...result]
    switch (sortBy) {
      case 'fastest':
        result.sort((a, b) => (a.estimated_delivery_min ?? 99) - (b.estimated_delivery_min ?? 99))
        break
      case 'highest_rated':
        result.sort((a, b) => (b.avg_rating ?? b.rating) - (a.avg_rating ?? a.rating))
        break
      case 'lowest_fee':
        result.sort((a, b) => a.delivery_fee - b.delivery_fee)
        break
      case 'nearest':
        if (customerLocation) {
          result.sort((a, b) => {
            const distA = (a.lat && a.lng) ? haversineDistance(customerLocation.lat, customerLocation.lng, a.lat, a.lng) : 9999
            const distB = (b.lat && b.lng) ? haversineDistance(customerLocation.lat, customerLocation.lng, b.lat, b.lng) : 9999
            return distA - distB
          })
        }
        break
      // 'recommended' keeps default order (by rating from API)
    }

    return result
  }, [shops, search, activeCategory, favoriteIds, sortBy, customerLocation])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Navbar: desktop only */}
      <div className="desktop-only">
        <Navbar />
      </div>

      <main style={{ flex: 1, paddingBottom: '80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>

          {/* Search Bar with dropdown */}
          <div style={{ marginBottom: '12px', position: 'relative' }} ref={dropdownRef}>
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
                placeholder="Search shops or menu items..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => {
                  if (itemResults.length > 0) setShowDropdown(true)
                }}
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
                  onClick={() => { setSearch(''); setShowDropdown(false) }}
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

            {/* Item search dropdown */}
            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: '48px',
                left: 0,
                right: 0,
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                zIndex: 100,
                maxHeight: '360px',
                overflowY: 'auto',
                border: '1px solid #eee',
              }}>
                {searchingItems ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                    Searching...
                  </div>
                ) : itemResults.length > 0 ? (
                  <div style={{ padding: '8px 0' }}>
                    <div style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Menu Items
                    </div>
                    {itemResults.map(group => (
                      <div key={group.shop.id}>
                        {group.items.map((item, idx) => (
                          <Link
                            key={`${group.shop.id}-${idx}`}
                            href={`/shops/${group.shop.slug}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 14px',
                              gap: '10px',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                            }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: item.image_url
                                  ? `url(${item.image_url}) center/cover no-repeat`
                                  : 'linear-gradient(135deg, #FFE4E1, #FFB6C1)',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                              }}>
                                {!item.image_url && '🍩'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: '#1A1A2E',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {item.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#999' }}>
                                  {group.shop.name}
                                </div>
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#FF1493',
                                flexShrink: 0,
                              }}>
                                ${item.price.toFixed(2)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {cat === 'Favorites' && (
                  <svg width="13" height="13" viewBox="0 0 24 24"
                    fill={activeCategory === 'Favorites' ? 'white' : '#FF1493'}
                    stroke="none"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                )}
                {cat}
              </button>
            ))}
          </div>

          {/* Sort Bar */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '12px',
            marginBottom: '4px',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
            {(Object.keys(sortLabels) as SortOption[]).map(option => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: '16px',
                  border: sortBy === option ? '1.5px solid #FF1493' : '1.5px solid #e0e0e0',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: sortBy === option ? '#FFF0F7' : '#fff',
                  color: sortBy === option ? '#FF1493' : '#666',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {sortLabels[option]}
              </button>
            ))}
          </div>

          {/* Location hint for Nearest sort */}
          {sortBy === 'nearest' && !customerLocation && (
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>📍</span> Enable location access to sort by distance
            </div>
          )}

          {/* Show entered delivery address when sorting by nearest */}
          {sortBy === 'nearest' && customerLocation && urlAddr && (
            <div style={{
              fontSize: '12px',
              color: '#666',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>📍</span>
              <span>Closest to: <strong style={{ color: '#1A1A2E' }}>{urlAddr}</strong></span>
            </div>
          )}

          {/* Surge pricing banner */}
          {surgeActive && (
            <div style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #FFA500, #FF8C00)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                Busy right now — delivery fees are higher than usual
              </span>
            </div>
          )}

          {/* Page Title */}
          <div style={{ marginBottom: '14px' }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#1A1A2E',
              margin: 0,
            }}>
              {activeCategory === 'Favorites' ? 'Your Favorite Shops' : 'Browse Donut Shops'}
            </h1>
            <p style={{ color: '#999', fontSize: '13px', margin: '4px 0 0' }}>
              {activeCategory === 'Favorites'
                ? (favoriteIds.size > 0 ? `${favoriteIds.size} saved shop${favoriteIds.size !== 1 ? 's' : ''}` : 'Tap the heart on any shop to save it')
                : 'Find the best donuts near you'
              }
            </p>
          </div>

          {/* Global styles for responsive layout */}
          <style>{`
            .shops-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }
            @media (min-width: 768px) {
              .shops-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            }
            @media (min-width: 1024px) {
              .shops-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
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
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#888',
            }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>
                {activeCategory === 'Favorites' ? '❤️' : customerLocation ? '📍' : '🍩'}
              </span>
              <h2 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                {activeCategory === 'Favorites'
                  ? 'No favorites yet'
                  : customerLocation ? 'We\'re not in your area yet'
                  : search ? 'No shops found' : 'No shops available yet'
                }
              </h2>
              <p style={{ fontSize: '14px' }}>
                {activeCategory === 'Favorites'
                  ? 'Tap the heart icon on any shop to add it to your favorites'
                  : customerLocation ? 'DonutDash currently serves Tyler, TX and surrounding East Texas areas within 30 miles.'
                  : search ? 'Try a different search term' : 'Check back soon for delicious donut shops!'
                }
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
