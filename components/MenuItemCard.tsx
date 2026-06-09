'use client'

import { useState } from 'react'
import { useCart } from '@/lib/cart-context'
import { trackEngagement } from '@/lib/track'
import type { MenuItem, VariantOption } from '@/lib/types'

interface MenuItemCardProps {
  item: MenuItem
  shopId: string
  shopName: string
  // True when the parent shop hasn't been claimed by its owner yet.
  // Lets us log "lost order" intent for the marketing pitch — these
  // clicks are the gold metric for proving demand to prospective
  // shop owners. Falls through harmlessly on claimed shops.
  shopIsUnclaimed?: boolean
  // Optional dual-pricing context. When the parent shop runs the
  // cash-discount program in 'dual_pricing' mode, the customer sees
  // BOTH prices on every item (cash + card) instead of the standard
  // single listed price. Both fields must be set for the alt price
  // to render — guards against half-configured shops.
  dualPricingPct?: number
}

export default function MenuItemCard({ item, shopId, shopName, shopIsUnclaimed, dualPricingPct }: MenuItemCardProps) {
  const { addItem, needsShopSwitch, switchShopAndAdd } = useCart()
  const isSoldOut = item.is_sold_out ?? false
  const [showModal, setShowModal] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const [added, setAdded] = useState(false)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  const hasVariants = item.variants && item.variants.length > 0
  const allVariantsSelected = !hasVariants || (item.variants?.every(v => !!selectedVariants[v.name]) === true)

  function getActivePrice(): number {
    if (!hasVariants) return item.price
    for (const v of item.variants!) {
      const selectedName = selectedVariants[v.name]
      if (selectedName) {
        const opt = v.options.find((o): o is VariantOption => typeof o === 'object' && o.name === selectedName)
        if (opt && opt.price > 0) return opt.price
      }
    }
    return item.price
  }

  function getPriceDisplay(): string {
    if (!hasVariants) return `$${item.price.toFixed(2)}`
    if (allVariantsSelected) return `$${getActivePrice().toFixed(2)}`
    const allPrices: number[] = []
    for (const v of item.variants!) {
      for (const o of v.options) {
        const p = typeof o === 'object' ? o.price : 0
        if (p > 0) allPrices.push(p)
      }
    }
    if (allPrices.length === 0) return `$${item.price.toFixed(2)}`
    const min = Math.min(...allPrices)
    const max = Math.max(...allPrices)
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}+`
  }

  // Compute the discounted (cash) version of the price string for the
  // dual-pricing display. Reuses getPriceDisplay() for the variant
  // logic so range strings like "$3.50+" come back as "$3.40+ cash".
  function getCashPriceDisplay(): string {
    if (!dualPricingPct || dualPricingPct <= 0) return ''
    const factor = 1 - dualPricingPct / 100
    if (!hasVariants) {
      return `$${(item.price * factor).toFixed(2)}`
    }
    if (allVariantsSelected) {
      return `$${(getActivePrice() * factor).toFixed(2)}`
    }
    const allPrices: number[] = []
    for (const v of item.variants!) {
      for (const o of v.options) {
        const p = typeof o === 'object' ? o.price : 0
        if (p > 0) allPrices.push(p)
      }
    }
    if (allPrices.length === 0) return `$${(item.price * factor).toFixed(2)}`
    const min = Math.min(...allPrices) * factor
    const max = Math.max(...allPrices) * factor
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}+`
  }

  const showDualPrice = !!dualPricingPct && dualPricingPct > 0

  const handleAddToCart = () => {
    // Log the intent BEFORE the cart-switch / variant gates — those are
    // legitimate flow steps, not abandons. We want every "I wanted this
    // donut" tap captured so the pitch can show real demand.
    if (shopIsUnclaimed) {
      trackEngagement({ shop_id: shopId, kind: 'lost_order_click' })
    }

    if (needsShopSwitch(shopId)) {
      setShowSwitchConfirm(true)
      return
    }

    if (!allVariantsSelected) {
      setShowModal(true)
      return
    }

    const activePrice = getActivePrice()
    const variantSuffix = hasVariants ? Object.values(selectedVariants).join(', ') : ''
    const cartItem = {
      id: variantSuffix ? `${item.id}::${variantSuffix}` : item.id,
      name: variantSuffix ? `${item.name} (${variantSuffix})` : item.name,
      price: activePrice,
      quantity,
      image_url: item.image_url,
      special_instructions: null,
    }

    const success = addItem(cartItem, shopId, shopName)
    if (success) {
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
      setShowModal(false)
      setQuantity(1)
      setSelectedVariants({})
    }
  }

  const handleSwitchShop = () => {
    const activePrice = getActivePrice()
    const variantSuffix = hasVariants ? Object.values(selectedVariants).join(', ') : ''
    const cartItem = {
      id: variantSuffix ? `${item.id}::${variantSuffix}` : item.id,
      name: variantSuffix ? `${item.name} (${variantSuffix})` : item.name,
      price: activePrice,
      quantity,
      image_url: item.image_url,
      special_instructions: null,
    }
    switchShopAndAdd(cartItem, shopId, shopName)
    setShowSwitchConfirm(false)
    setShowModal(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
    setQuantity(1)
    setSelectedVariants({})
  }

  // Wraps the card-tap so we fire menu_item_view on the open. Intent
  // signal: cashier-quality interest in this specific item — counts
  // toward the unclaimed-shop pitch headline alongside page_view and
  // lost_order_click. Sold-out items don't fire because the click is
  // a no-op.
  const handleCardClick = () => {
    if (isSoldOut) return
    if (shopIsUnclaimed) {
      trackEngagement({ shop_id: shopId, kind: 'menu_item_view' })
    }
    setShowModal(true)
  }

  return (
    <>
      <div
        onClick={handleCardClick}
        style={{
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #f0f0f0',
          cursor: isSoldOut ? 'default' : 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          opacity: isSoldOut ? 0.55 : 1,
          filter: isSoldOut ? 'grayscale(60%)' : 'none',
          position: 'relative',
        }}
        onMouseEnter={e => {
          if (!isSoldOut) {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div style={{
          width: '100%',
          height: '120px',
          minHeight: '80px',
          background: item.image_url
            ? `url(${item.image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {!item.image_url && <span style={{ fontSize: '2.5rem' }}>🍩</span>}
          {isSoldOut && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                background: '#DC2626',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.7rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}>SOLD OUT</span>
            </div>
          )}
          {added && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 20, 147, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
            }}>
              Added!
            </div>
          )}
        </div>

        <div style={{ padding: '0.5rem 0.6rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.15rem', color: '#1A1A2E', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            <span style={{ fontWeight: 700, color: '#1A1A2E', fontSize: '0.8rem' }}>
              {showDualPrice ? (
                <>
                  <span style={{ color: '#10B981' }}>{getCashPriceDisplay()}</span>
                  <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: '0.7rem' }}> / {getPriceDisplay()}</span>
                </>
              ) : (
                getPriceDisplay()
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isSoldOut) handleAddToCart()
              }}
              disabled={isSoldOut}
              style={{
                background: isSoldOut ? '#ccc' : '#FF8C00',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: isSoldOut ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!isSoldOut) e.currentTarget.style.background = '#e67e00' }}
              onMouseLeave={e => { if (!isSoldOut) e.currentTarget.style.background = '#FF8C00' }}
            >
              {isSoldOut ? 'Sold Out' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && (
        <div
          onClick={() => { setShowModal(false); setQuantity(1) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px', maxWidth: '440px',
              width: '100%', overflow: 'hidden',
            }}
          >
            <div style={{
              height: '220px',
              background: item.image_url
                ? `url(${item.image_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {!item.image_url && <span style={{ fontSize: '4rem' }}>🍩</span>}
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.5rem' }}>{item.name}</h3>
              {item.description && (
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {item.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
                {showDualPrice ? (
                  <>
                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#10B981' }}>
                      {getCashPriceDisplay()} <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1 }}>CASH</span>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#9CA3AF' }}>
                      {getPriceDisplay()} <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1 }}>CARD</span>
                    </span>
                  </>
                ) : (
                  <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#FF1493' }}>
                    {getPriceDisplay()}
                  </span>
                )}
                {item.prep_time_min != null && item.prep_time_min > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#888', background: '#f5f5f5', padding: '2px 8px', borderRadius: 6, fontWeight: 500 }}>
                    ~{item.prep_time_min} min prep
                  </span>
                )}
              </div>

              {hasVariants && item.variants!.map(variant => (
                <div key={variant.name} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '0.35rem' }}>{variant.name}</label>
                  <select
                    value={selectedVariants[variant.name] || ''}
                    onChange={e => setSelectedVariants(prev => ({ ...prev, [variant.name]: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.85rem', background: 'white' }}
                  >
                    <option value="">Select {variant.name.toLowerCase()}</option>
                    {variant.options.map(opt => {
                      const optName = typeof opt === 'string' ? opt : opt.name
                      const optPrice = typeof opt === 'object' && opt.price > 0 ? ` — $${opt.price.toFixed(2)}` : ''
                      return <option key={optName} value={optName}>{optName}{optPrice}</option>
                    })}
                  </select>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Quantity:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!allVariantsSelected}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: (!allVariantsSelected) ? '#ccc' : '#FF8C00',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '1rem', fontWeight: 700,
                  cursor: (!allVariantsSelected) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { if (allVariantsSelected) e.currentTarget.style.background = '#e67e00' }}
                onMouseLeave={e => { if (allVariantsSelected) e.currentTarget.style.background = '#FF8C00' }}
              >
                {!allVariantsSelected ? 'Select Options' : `Add to Cart - $${(getActivePrice() * quantity).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Shop Confirm */}
      {showSwitchConfirm && (
        <div
          onClick={() => setShowSwitchConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px', padding: '2rem',
              maxWidth: '380px', width: '100%', textAlign: 'center',
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Switch shop?
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Your cart has items from another shop. Would you like to clear your cart and add items from this shop instead?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowSwitchConfirm(false)}
                style={{
                  flex: 1, padding: '0.7rem', border: '1px solid #ddd',
                  borderRadius: '10px', background: 'white', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchShop}
                style={{
                  flex: 1, padding: '0.7rem', border: 'none',
                  borderRadius: '10px', background: '#FF1493', color: 'white',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
