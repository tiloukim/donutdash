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
  return <span style={{ fontSize: '11px', lineHeight: 1 }}>{stars}</span>
}

interface ShopCardProps {
  shop: Shop
  isFavorited?: boolean
  onToggleFavorite?: (shopId: string) => void
}

export default function ShopCard({ shop, isFavorited, onToggleFavorite }: ShopCardProps) {
  return (
    <div style={{ position: 'relative' }}>
      <Link href={`/shops/${shop.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{
            width: '100%',
            aspectRatio: '1',
            background: shop.image_url
              ? `url(${shop.image_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #FF69B4, #FF1493)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {!shop.image_url && (
              <span style={{ fontSize: '2.5rem' }}>🍩</span>
            )}
          </div>

          <div style={{ padding: '8px 10px 10px' }}>
            <h3 style={{
              fontWeight: 700,
              fontSize: '14px',
              color: '#1A1A2E',
              margin: 0,
              lineHeight: 1.3,
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
              marginTop: '4px',
            }}>
              <StarRating rating={shop.rating} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A2E' }}>
                {shop.rating.toFixed(1)}
              </span>
              <span style={{ fontSize: '11px', color: '#999' }}>
                ({shop.review_count})
              </span>
            </div>

            <div style={{
              fontSize: '12px',
              color: '#777',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>🕐</span>
              <span>{shop.estimated_delivery_min && shop.estimated_delivery_max
                ? `${shop.estimated_delivery_min}-${shop.estimated_delivery_max} min`
                : '20-35 min'}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Favorite heart button */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite(shop.id)
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            zIndex: 2,
            padding: 0,
            transition: 'transform 0.15s',
          }}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isFavorited ? '#FF1493' : 'none'}
            stroke={isFavorited ? '#FF1493' : '#666'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
    </div>
  )
}
