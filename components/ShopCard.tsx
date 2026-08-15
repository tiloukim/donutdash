'use client'

import Link from 'next/link'
import type { Shop } from '@/lib/types'
import DonutIcon from './DonutIcon'
import { estimateDeliveryEta, DEFAULT_ETA_LABEL } from '@/lib/eta'

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
  // Unclaimed shops are "claimable" marketplace listings, not orderable — show
  // the claim CTA and route to the claim page on every device so a customer
  // never lands on an order page with no menu (a dead end).
  const isUnclaimed = shop.is_claimed === false
  const showClaimUI = isUnclaimed
  const href = showClaimUI ? `/shops/claim/${shop.slug}` : `/shops/${shop.slug}`

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <div style={{
            width: '100%',
            aspectRatio: '1',
            background: shop.image_url
              ? `url(${shop.image_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #FFE4F1 0%, #FFD6E8 50%, #FFC0D9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            {!shop.image_url && (
              <DonutIcon size={90} />
            )}

            {/* Sponsored badge — paid featured placement */}
            {shop.sponsored && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: 'linear-gradient(135deg, #FF8C00, #FFB300)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                  zIndex: 1,
                }}
              >
                ⭐ Sponsored
              </div>
            )}

            {/* Coming-soon badge for unclaimed (not-yet-onboarded) shops */}
            {showClaimUI && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: 'rgba(255,255,255,0.95)',
                  border: '1.5px solid #FF1493',
                  color: '#FF1493',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: 1,
                }}
              >
                Coming soon
              </div>
            )}
          </div>

          <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{
                fontWeight: 700,
                fontSize: '14px',
                color: '#1A1A2E',
                margin: 0,
                lineHeight: 1.3,
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
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  background: '#F97316',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  flexShrink: 0,
                  lineHeight: '16px',
                }}>
                  Busy
                </span>
              )}
            </div>

            {shop.is_busy && (
              <div style={{ fontSize: '11px', color: '#F97316', marginTop: '2px' }}>
                Longer wait times
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
            }}>
              <StarRating rating={shop.avg_rating ?? shop.rating} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A2E' }}>
                {(shop.avg_rating ?? shop.rating).toFixed(1)}
              </span>
              <span style={{ fontSize: '11px', color: '#999' }}>
                ({shop.review_count})
              </span>
            </div>

            {showClaimUI ? (
              <div style={{
                marginTop: 'auto',
                paddingTop: '8px',
              }}>
                {shop.distance_miles != null && (
                  <div style={{
                    fontSize: '12px',
                    color: '#FF1493',
                    fontWeight: 600,
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span>📍</span> {shop.distance_miles.toFixed(1)} mi away
                  </div>
                )}
                <div style={{
                  padding: '6px 10px',
                  background: '#FFF0F5',
                  border: '1px solid #FF1493',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#FF1493',
                  textAlign: 'center',
                  letterSpacing: '0.2px',
                }}>
                  Coming soon
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: '12px',
                color: '#777',
                marginTop: 'auto',
                paddingTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}>
                <span>🕐 {shop.distance_miles != null
                  ? estimateDeliveryEta(shop.distance_miles).label
                  : shop.estimated_delivery_min && shop.estimated_delivery_max
                  ? `${shop.estimated_delivery_min}-${shop.estimated_delivery_max} min`
                  : DEFAULT_ETA_LABEL}</span>
                {shop.distance_miles != null && (
                  <>
                    <span style={{ color: '#ddd' }}>•</span>
                    <span style={{ color: '#FF1493', fontWeight: 600 }}>
                      📍 {shop.distance_miles.toFixed(1)} mi
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Favorite heart button — hidden when showing the claim CTA (desktop unclaimed) */}
      {onToggleFavorite && !showClaimUI && (
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
