'use client'

import { useState, useEffect, useRef } from 'react'

interface Shop {
  id: string
  name: string
  slug: string
  address: string
  city: string
  state: string
  zip: string
  phone: string | null
  rating: number
  review_count: number
  image_url: string | null
  is_claimed: boolean
}

export default function FlyerGenerator() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'claimed'>('unclaimed')
  const flyerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/shops')
      .then(r => r.json())
      .then(d => setShops(d.shops || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredShops = shops.filter(s => {
    if (filter === 'unclaimed') return s.is_claimed === false
    if (filter === 'claimed') return s.is_claimed !== false
    return true
  })

  const generatePDF = async (shop: Shop) => {
    setSelectedShop(shop)
    setGenerating(true)

    // Wait for render
    await new Promise(r => setTimeout(r, 500))

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const element = flyerRef.current
      if (!element) return

      await html2pdf()
        .set({
          margin: 0,
          filename: `DonutDash-Flyer-${shop.slug}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(element)
        .save()
    } catch (err) {
      console.error('PDF error:', err)
    } finally {
      setGenerating(false)
    }
  }

  const generateAll = async () => {
    for (const shop of filteredShops) {
      await generatePDF(shop)
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading shops...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1A1A2E' }}>Shop Flyer Generator</h2>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>Create recruitment flyers for donut shop owners</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['unclaimed', 'claimed', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
              background: filter === f ? '#6366F1' : '#f0f0f0',
              color: filter === f ? '#fff' : '#666', cursor: 'pointer',
            }}>
              {f === 'all' ? 'All' : f === 'unclaimed' ? 'Unclaimed' : 'Claimed'} ({shops.filter(s => f === 'all' ? true : f === 'unclaimed' ? s.is_claimed === false : s.is_claimed !== false).length})
            </button>
          ))}
        </div>
      </div>

      {filteredShops.length > 1 && (
        <button onClick={generateAll} disabled={generating} style={{
          marginBottom: 16, padding: '10px 24px', borderRadius: 10, border: 'none',
          background: generating ? '#ccc' : '#6366F1', color: '#fff', fontWeight: 700,
          fontSize: 14, cursor: generating ? 'wait' : 'pointer',
        }}>
          {generating ? 'Generating...' : `Download All Flyers (${filteredShops.length})`}
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filteredShops.map(shop => (
          <div key={shop.id} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {shop.image_url ? (
                <img src={shop.image_url} alt={shop.name} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: '#FFE4F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍩</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{shop.city}, {shop.state}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{shop.address}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#F59E0B' }}>★ {shop.rating.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#999' }}>({shop.review_count} reviews)</span>
              {shop.is_claimed === false && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#FF1493', background: '#FFF0F5', padding: '2px 6px', borderRadius: 4 }}>Unclaimed</span>
              )}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => generatePDF(shop)} disabled={generating} style={{
                flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',
                background: generating && selectedShop?.id === shop.id ? '#ccc' : '#FF1493',
                color: '#fff', fontWeight: 600, fontSize: 13, cursor: generating ? 'wait' : 'pointer',
              }}>
                {generating && selectedShop?.id === shop.id ? 'Generating...' : '📄 Flyer'}
              </button>
              <a
                href={`/api/qr/shop?slug=${shop.slug}&type=${shop.is_claimed === false ? 'claim' : 'order'}&size=400&color=%23FF1493`}
                download={`QR-${shop.slug}.png`}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#333', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', textDecoration: 'none', textAlign: 'center',
                }}
              >
                QR
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden flyer template for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={flyerRef}>
          {selectedShop && <FlyerTemplate shop={selectedShop} />}
        </div>
      </div>
    </div>
  )
}

function FlyerTemplate({ shop }: { shop: Shop }) {
  const claimUrl = `www.donutdash.app/shops/claim/${shop.slug}`
  const shopUrl = `www.donutdash.app/shops/${shop.slug}`

  return (
    <div style={{
      width: '8.5in', minHeight: '11in', background: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column', padding: '0.4in 0.5in',
      boxSizing: 'border-box',
    }}>
      {/* Header: logo + headline combined */}
      <div style={{
        background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
        borderRadius: '12px', padding: '14px 20px', textAlign: 'center',
        marginBottom: '0.15in', color: '#fff',
      }}>
        <img src="/logo-white.png" alt="DonutDash" style={{ height: '40px', width: 'auto', marginBottom: 6, filter: 'brightness(10)' }} />
        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 2px 0', lineHeight: 1.2 }}>
          Your Shop Is Already on DonutDash!
        </h1>
        <p style={{ fontSize: '13px', margin: 0, opacity: 0.9 }}>
          Claim your listing and start receiving online orders today
        </p>
      </div>

      {/* Shop card */}
      <div style={{
        border: '2px solid #FF1493', borderRadius: '10px', padding: '10px 14px',
        marginBottom: '0.15in', display: 'flex', gap: '12px', alignItems: 'center',
      }}>
        {shop.image_url ? (
          <img src={shop.image_url} alt={shop.name} width={65} height={65} style={{ borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 65, height: 65, borderRadius: 8, background: '#FFE4F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🍩</div>
        )}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1A1A2E', margin: '0 0 2px 0' }}>{shop.name}</h2>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 2px 0' }}>{shop.address}, {shop.city}, {shop.state} {shop.zip}</p>
          <p style={{ fontSize: '12px', color: '#F59E0B', margin: 0, fontWeight: 600 }}>
            ★ {shop.rating.toFixed(1)} ({shop.review_count} Google reviews)
          </p>
        </div>
      </div>

      {/* Benefits + How to claim side by side */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '0.15in' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A2E', margin: '0 0 6px 0' }}>
            Why Join DonutDash?
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { icon: '📱', text: 'Online ordering from customers\' phones' },
              { icon: '🚗', text: 'We handle all deliveries' },
              { icon: '📊', text: 'Dashboard for orders, menu & analytics' },
              { icon: '💰', text: 'Weekly direct deposit payouts' },
              { icon: '⭐', text: 'Reviews & ratings to build reputation' },
              { icon: '📈', text: 'Reach more customers online' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ fontSize: '14px' }}>{b.icon}</span>
                <span style={{ color: '#333' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          width: '40%', background: '#FFF0F5', borderRadius: '10px', padding: '12px',
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#FF1493', margin: '0 0 8px 0' }}>
            3 Easy Steps
          </h3>
          {[
            { step: '1', text: 'Scan QR code below' },
            { step: '2', text: 'Create account & upload docs' },
            { step: '3', text: 'Set up menu & start selling!' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#FF1493',
                color: '#fff', fontSize: '12px', fontWeight: 800, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{s.step}</div>
              <div style={{ fontSize: '11px', color: '#444' }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA with QR Code */}
      <div style={{
        background: '#1A1A2E', borderRadius: '12px', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>
            Scan to claim your shop:
          </p>
          <p style={{ color: '#FF1493', fontSize: '12px', fontWeight: 800, margin: '0 0 8px 0', wordBreak: 'break-all' }}>
            {shop.is_claimed === false ? claimUrl : shopUrl}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0 }}>
            Or call: <span style={{ color: '#FF8C00', fontWeight: 700 }}>(430) 999-0168</span>
          </p>
        </div>
        <div style={{
          flexShrink: 0, background: '#fff', borderRadius: 8, padding: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://donutdash.app/api/qr/shop?slug=${shop.slug}&type=${shop.is_claimed === false ? 'claim' : 'order'}&size=200&color=%23FF1493`}
            alt="QR Code"
            width={100}
            height={100}
            style={{ display: 'block' }}
          />
          <div style={{ fontSize: '8px', color: '#888', marginTop: 2, fontWeight: 600 }}>SCAN ME</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '0.08in' }}>
        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
          Questions? <span style={{ color: '#FF1493', fontWeight: 600 }}>shops@donutdash.app</span> | <span style={{ color: '#FF8C00', fontWeight: 600 }}>(430) 999-0168</span> | www.donutdash.app
        </p>
      </div>
    </div>
  )
}
