'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ShopCard from '@/components/ShopCard'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import type { Shop } from '@/lib/types'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const { user } = useAuth()
  const { count } = useCart()

  useEffect(() => {
    fetch('/api/shops')
      .then(res => res.json())
      .then(data => setShops(data.shops || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [])

  const PINK = '#FF1493'
  const ORANGE = '#FF8C00'
  const categories = ['All', 'Donuts', 'Coffee', 'Breakfast']

  const promoBanners = [
    {
      title: 'EARN Rewards!',
      subtitle: 'Order 5 times, get a free donut',
      bg: `linear-gradient(135deg, ${PINK}, #FF69B4)`,
      emoji: '🎁',
    },
    {
      title: 'New Kolaches!',
      subtitle: 'Try our fresh breakfast kolaches',
      bg: `linear-gradient(135deg, ${ORANGE}, #FFA500)`,
      emoji: '🥐',
    },
    {
      title: 'Free Delivery',
      subtitle: 'On orders over $15 this week',
      bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
      emoji: '🚗',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
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
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '1rem',
            }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          ) : (
            <Link href="/login" style={{
              padding: '8px 16px', background: PINK, color: 'white',
              borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
            }}>
              Sign In
            </Link>
          )}
        </div>

        {/* Delivery address */}
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
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={PINK} stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>Deliver to</span>
            <span style={{ color: '#1A1A2E', fontWeight: 700 }}>
              {user ? 'Saved Address' : 'Set delivery address'}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="3">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
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
              placeholder="Search for donuts, coffee..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
          </div>
        </div>

        {/* Promo Banners - horizontal scroll */}
        <div style={{
          padding: '0 0 0 20px',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            paddingRight: '20px',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
            {promoBanners.map((promo, i) => (
              <div key={i} style={{
                minWidth: '260px',
                height: '120px',
                borderRadius: '16px',
                background: promo.bg,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                scrollSnapAlign: 'start',
                flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '8px',
                  fontSize: '3rem',
                  opacity: 0.3,
                }}>
                  {promo.emoji}
                </span>
                <h3 style={{
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  margin: '0 0 4px',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {promo.title}
                </h3>
                <p style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.8rem',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {promo.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

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

        {/* Section label */}
        <div style={{
          padding: '0 20px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
            Nearby Shops
          </h2>
          <Link href="/shops" style={{ color: PINK, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            See All
          </Link>
        </div>

        {/* Shop cards - 2 column grid */}
        <div style={{ padding: '0 20px', paddingBottom: '100px' }}>
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
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
          ) : shops.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}>
              {shops.slice(0, 8).map(shop => (
                <Link
                  key={shop.id}
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
                        : `linear-gradient(135deg, #FF69B4, ${PINK})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {!shop.image_url && (
                        <span style={{ fontSize: '2.5rem' }}>🍩</span>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <h3 style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        margin: '0 0 4px',
                        color: '#1A1A2E',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {shop.name}
                      </h3>
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
                        gap: '8px',
                        fontSize: '0.7rem',
                        color: '#888',
                      }}>
                        <span>20-35 min</span>
                        <span style={{ color: '#ddd' }}>|</span>
                        <span>${shop.delivery_fee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
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
          background: `linear-gradient(135deg, ${PINK} 0%, #FF69B4 50%, #FFB6C1 100%)`,
          padding: '5rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '10%', left: '5%', fontSize: '4rem', opacity: 0.15,
          }}>🍩</div>
          <div style={{
            position: 'absolute', bottom: '10%', right: '8%', fontSize: '5rem', opacity: 0.15,
          }}>🍩</div>

          <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
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
              margin: '0 auto',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}>
              <input
                type="text"
                placeholder="Enter your delivery address..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '1rem 1.25rem',
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  color: '#1A1A2E',
                }}
              />
              <Link href="/shops" style={{
                background: ORANGE,
                color: 'white',
                padding: '1rem 1.5rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}>
                Find Shops
              </Link>
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

        {/* Featured Shops */}
        <section style={{ padding: '4rem 1.5rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem',
            }}>
              <div>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: '#1A1A2E' }}>
                  Featured Shops
                </h2>
                <p style={{ color: '#888', fontSize: '0.95rem' }}>
                  Popular donut shops near you
                </p>
              </div>
              <Link href="/shops" style={{
                color: PINK, fontWeight: 600, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                View All &rarr;
              </Link>
            </div>

            {loading ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem',
              }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    background: '#f5f5f5', borderRadius: '14px', height: '280px',
                  }} />
                ))}
              </div>
            ) : shops.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem',
              }}>
                {shops.slice(0, 6).map(shop => (
                  <ShopCard key={shop.id} shop={shop} />
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
        <Footer />
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
