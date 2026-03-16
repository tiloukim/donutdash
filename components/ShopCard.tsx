'use client'

import Link from 'next/link'
import type { Shop } from '@/lib/types'

function StarRating({ rating }: { rating: number }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<span key={i} style={{ color: '#FFB800' }}>&#9733;</span>)
    } else if (i - 0.5 <= rating) {
      stars.push(<span key={i} style={{ color: '#FFB800' }}>&#9733;</span>)
    } else {
      stars.push(<span key={i} style={{ color: '#ddd' }}>&#9733;</span>)
    }
  }
  return <span style={{ fontSize: '0.85rem' }}>{stars}</span>
}

export default function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link href={`/shops/${shop.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          background: 'white',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid #f0f0f0',
          transition: 'all 0.25s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 20, 147, 0.15)'
          e.currentTarget.style.borderColor = '#FF69B4'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = '#f0f0f0'
        }}
      >
        <div style={{
          width: '100%',
          height: '180px',
          background: shop.image_url
            ? `url(${shop.image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #FF69B4, #FF1493)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {!shop.image_url && (
            <span style={{ fontSize: '3rem' }}>🍩</span>
          )}
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
            {shop.name}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <StarRating rating={shop.rating} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A1A2E' }}>{shop.rating.toFixed(1)}</span>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>({shop.review_count})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#666' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              🕐 20-35 min
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ${shop.delivery_fee.toFixed(2)} delivery
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
