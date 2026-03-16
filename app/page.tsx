'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ShopCard from '@/components/ShopCard'
import type { Shop } from '@/lib/types'

export default function HomePage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FFB6C1 100%)',
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
        <div style={{
          position: 'absolute', top: '30%', right: '20%', fontSize: '3rem', opacity: 0.1,
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
            Delicious Donuts{' '}
            <span style={{ display: 'block' }}>Delivered Fast</span>
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
              background: '#FF8C00',
              color: 'white',
              padding: '1rem 1.5rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
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
              color: '#FF1493', fontWeight: 600, fontSize: '0.95rem',
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
          background: '#FF1493',
          color: 'white',
          padding: '0.9rem 2.5rem',
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '1.05rem',
          transition: 'background 0.2s',
        }}>
          Browse Shops
        </Link>
      </section>

      <Footer />
    </div>
  )
}
