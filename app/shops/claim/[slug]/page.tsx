'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import type { Shop } from '@/lib/types'

export default function ClaimShopPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`/api/shops?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        const found: Shop | undefined = (data.shops || [])[0]
        if (!found) {
          setNotFound(true)
          return
        }
        setShop(found)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleClaimNow() {
    if (!shop) return
    setError('')
    setClaiming(true)
    try {
      const res = await fetch('/api/shop/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shop.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to claim shop')
        return
      }
      router.push('/shop')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div className="desktop-only"><Navbar /></div>
        <main style={{ flex: 1, padding: '2rem', textAlign: 'center', color: '#999' }}>
          Loading shop...
        </main>
      </div>
    )
  }

  if (notFound || !shop) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div className="desktop-only"><Navbar /></div>
        <main style={{ flex: 1, padding: '3rem 1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A2E' }}>Shop not found</h1>
          <p style={{ color: '#888', marginTop: '0.5rem' }}>
            We couldn&apos;t find that shop.
          </p>
          <Link
            href="/shops"
            style={{ color: '#FF1493', fontWeight: 600, display: 'inline-block', marginTop: '1rem' }}
          >
            &larr; Back to shops
          </Link>
        </main>
      </div>
    )
  }

  const alreadyClaimed = shop.is_claimed !== false

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="desktop-only"><Navbar /></div>

      <main style={{ flex: 1, paddingBottom: '80px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px' }}>
          <Link
            href="/shops"
            style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}
          >
            &larr; Back to shops
          </Link>

          {/* Shop header */}
          <div style={{
            marginTop: '16px',
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0',
          }}>
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              background: shop.image_url
                ? `url(${shop.image_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #FF69B4, #FF1493)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              {!shop.image_url && <span style={{ fontSize: '3rem' }}>🍩</span>}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(255,255,255,0.95)',
                border: '1.5px solid #FF1493',
                color: '#FF1493',
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '12px',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}>
                Unclaimed
              </div>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <h1 style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#1A1A2E',
                margin: 0,
              }}>
                {shop.name}
              </h1>
              <p style={{
                color: '#666',
                fontSize: '13px',
                margin: '6px 0 0',
                lineHeight: 1.5,
              }}>
                {shop.address}
                {shop.city ? `, ${shop.city}` : ''}
                {shop.state ? `, ${shop.state}` : ''}
                {shop.zip ? ` ${shop.zip}` : ''}
              </p>
              {shop.phone && (
                <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0' }}>
                  {shop.phone}
                </p>
              )}
            </div>
          </div>

          {/* If the shop is actually already claimed, short-circuit */}
          {alreadyClaimed ? (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#F0FFF4',
              border: '1px solid #9AE6B4',
              borderRadius: '12px',
              color: '#22543D',
              fontSize: '14px',
            }}>
              This shop has already been claimed.{' '}
              <Link href={`/shops/${shop.slug}`} style={{ color: '#FF1493', fontWeight: 600 }}>
                View shop
              </Link>
            </div>
          ) : (
            <>
              {/* Info box */}
              <div style={{
                marginTop: '20px',
                padding: '16px 18px',
                background: '#FFF0F5',
                border: '1px solid #FFD6E7',
                borderRadius: '12px',
              }}>
                <h2 style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#1A1A2E',
                  margin: 0,
                }}>
                  Are you the owner?
                </h2>
                <p style={{
                  color: '#555',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  margin: '8px 0 0',
                }}>
                  We found this shop on Google and added it to DonutDash so customers can discover it.
                  When you claim it, you&apos;ll be able to:
                </p>
                <ul style={{
                  color: '#555',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  marginTop: '8px',
                  paddingLeft: '1.1rem',
                }}>
                  <li>Set up your menu and pricing</li>
                  <li>Accept and manage online orders</li>
                  <li>Update your hours, photos, and contact info</li>
                  <li>Get paid directly via Stripe Connect</li>
                </ul>
              </div>

              {/* CTAs */}
              {error && (
                <div style={{
                  marginTop: '16px',
                  background: '#F8D7DA',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  color: '#721C24',
                }}>
                  {error}
                </div>
              )}

              {user ? (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={handleClaimNow}
                    disabled={claiming}
                    style={{
                      width: '100%',
                      padding: '0.95rem',
                      background: claiming ? '#ccc' : '#FF1493',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: claiming ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { if (!claiming) e.currentTarget.style.background = '#FF69B4' }}
                    onMouseLeave={e => { if (!claiming) e.currentTarget.style.background = '#FF1493' }}
                  >
                    {claiming ? 'Claiming...' : 'Claim this shop'}
                  </button>
                  <p style={{ color: '#888', fontSize: '12px', textAlign: 'center', margin: 0 }}>
                    You&apos;re signed in as {user.email}. We&apos;ll use this account as the shop owner.
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link
                    href={`/signup?role=shop_owner&claim=${shop.id}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.95rem',
                      background: '#FF1493',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      textDecoration: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    Sign up as owner
                  </Link>
                  <Link
                    href={`/login?claim=${shop.id}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.95rem',
                      background: 'white',
                      color: '#FF1493',
                      border: '1.5px solid #FF1493',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      textDecoration: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    Already have an account? Sign in
                  </Link>
                </div>
              )}

              <p style={{ color: '#aaa', fontSize: '11px', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
                By claiming this shop you confirm you are authorized to represent this business.
                We may verify ownership later.
              </p>
            </>
          )}
        </div>
      </main>

      <style>{`
        .desktop-only { display: block; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
        }
      `}</style>

      <div className="desktop-only"><Footer /></div>
      <MobileBottomNav />
    </div>
  )
}
