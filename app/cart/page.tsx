'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, SMALL_ORDER_FEE, MIN_ORDER_AMOUNT } from '@/lib/constants'

export default function CartPage() {
  const router = useRouter()
  const { items, total, count, updateQty, removeItem, clearCart, shopName, shopId } = useCart()
  const { user } = useAuth()
  const [shopMinOrder, setShopMinOrder] = useState<number>(0)
  const [shopTaxRate, setShopTaxRate] = useState<number>(0)
  const [shopDeliveryFee, setShopDeliveryFee] = useState<number>(DEFAULT_DELIVERY_FEE)
  const [shopServiceFeeRate, setShopServiceFeeRate] = useState<number>(SERVICE_FEE_RATE * 100)

  useEffect(() => {
    if (!shopId) return
    fetch(`/api/shops/${shopId}`)
      .then(r => r.json())
      .then(data => {
        const s = data?.shop || data
        if (!s) return
        if (typeof s.min_order === 'number') setShopMinOrder(s.min_order)
        if (typeof s.tax_rate === 'number') setShopTaxRate(s.tax_rate)
        if (typeof s.delivery_fee === 'number') setShopDeliveryFee(s.delivery_fee)
        if (typeof s.service_fee_pct === 'number') setShopServiceFeeRate(s.service_fee_pct)
      })
      .catch(() => {})
  }, [shopId])

  // Fixed tip amounts work better than percentages for low-AOV donut orders.
  // 100% pass-through to driver.
  const tipOptions = [
    { amount: 2, popular: false },
    { amount: 3, popular: true },
    { amount: 5, popular: false },
  ]

  const [selectedTipIndex, setSelectedTipIndex] = useState<number>(1) // default $3
  const [customTip, setCustomTip] = useState('')
  const [showCustomTip, setShowCustomTip] = useState(false)
  const [feesExpanded, setFeesExpanded] = useState(false)
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery')
  const isPickup = fulfillmentType === 'pickup'

  // Cart shows the BASE delivery fee. Final fee may be higher if delivery
  // address is beyond 1 mile (computed server-side at checkout). Pickup is free.
  const deliveryFee = isPickup ? 0 : (count > 0 ? shopDeliveryFee : 0)
  const serviceFee = Math.round(total * (shopServiceFeeRate / 100) * 100) / 100
  const smallOrderFee = count > 0 && total < MIN_ORDER_AMOUNT ? SMALL_ORDER_FEE : 0
  const tip = isPickup
    ? 0
    : showCustomTip
      ? (parseFloat(customTip) || 0)
      : (tipOptions[selectedTipIndex]?.amount ?? 0)
  // Tax basis matches the API: subtotal + delivery + service + small order fee.
  // Tip is excluded.
  const tax = Math.round((total + deliveryFee + serviceFee + smallOrderFee) * (shopTaxRate / 100) * 100) / 100
  const grandTotal = Math.round((total + deliveryFee + serviceFee + smallOrderFee + tax + tip) * 100) / 100
  const meetsMinimum = total >= shopMinOrder

  // Empty cart state
  if (count === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
        <div className="desktop-only">
          <Navbar />
        </div>

        {/* Mobile back header */}
        <div className="mobile-only" style={{
          padding: '16px',
          background: 'white',
          borderBottom: '1px solid #f0f0f0',
          alignItems: 'center',
          gap: '12px',
        }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E' }}>Your Cart</span>
        </div>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingBottom: '100px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '5rem', display: 'block', marginBottom: '1.5rem' }}>🛒</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
              Your cart is empty
            </h1>
            <p style={{ color: '#888', marginBottom: '2rem', fontSize: '1rem' }}>
              Add some delicious donuts to get started!
            </p>
            <Link href="/shops" style={{
              background: '#FF8C00', color: 'white', padding: '0.85rem 2rem',
              borderRadius: '25px', fontWeight: 700, display: 'inline-block',
              fontSize: '1rem',
            }}>
              Browse Shops
            </Link>
          </div>
        </main>

        <div className="desktop-only">
        </div>
        <MobileBottomNav />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
      {/* Desktop Navbar */}
      <div className="desktop-only">
        <Navbar />
      </div>

      {/* Mobile top bar with back button */}
      <div className="mobile-only" style={{
        padding: '12px 16px',
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E' }}>Your Cart</span>
        </div>
        <button
          onClick={clearCart}
          style={{
            background: 'none', border: 'none', color: '#FF1493',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <main style={{ flex: 1, paddingBottom: '140px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0' }}>

          {/* Desktop header */}
          <div className="desktop-only" style={{ padding: '2rem 1.5rem 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E' }}>Your Cart</h1>
                {shopName && (
                  <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    From {shopName}
                  </p>
                )}
              </div>
              <button
                onClick={clearCart}
                style={{
                  background: 'none', border: '1px solid #ddd', borderRadius: '20px',
                  padding: '0.4rem 1rem', color: '#888', fontSize: '0.85rem',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Delivery info / shop badge */}
          {shopName && (
            <div style={{
              margin: '12px 16px 0',
              padding: '12px 16px',
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: '#FFF3E0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
              }}>
                🏪
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1A1A2E' }}>{shopName}</div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>{isPickup ? 'Pickup at shop' : 'Delivery 25-35 min'}</div>
              </div>
            </div>
          )}

          {/* Delivery / Pickup toggle */}
          <div style={{
            margin: '12px 16px 0',
            padding: '12px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f0f0f0',
            display: 'flex',
            gap: '8px',
          }}>
            <button
              type="button"
              onClick={() => setFulfillmentType('delivery')}
              style={{
                flex: 1, padding: '12px',
                borderRadius: '10px',
                border: !isPickup ? '2px solid #FF1493' : '1px solid #e5e7eb',
                background: !isPickup ? '#FFF0F7' : 'white',
                color: !isPickup ? '#FF1493' : '#666',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🚗 Delivery
            </button>
            <button
              type="button"
              onClick={() => setFulfillmentType('pickup')}
              style={{
                flex: 1, padding: '12px',
                borderRadius: '10px',
                border: isPickup ? '2px solid #FF1493' : '1px solid #e5e7eb',
                background: isPickup ? '#FFF0F7' : 'white',
                color: isPickup ? '#FF1493' : '#666',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🏪 Pickup
            </button>
          </div>

          {/* Cart Items */}
          <div style={{
            margin: '12px 16px 0',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            {items.map((item, index) => (
              <div key={item.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderBottom: index < items.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                {/* Item image */}
                <div style={{
                  width: '60px', height: '60px', borderRadius: '10px', flexShrink: 0,
                  background: item.image_url
                    ? `url(${item.image_url}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!item.image_url && <span style={{ fontSize: '1.5rem' }}>🍩</span>}
                </div>

                {/* Name + shop + qty controls */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    fontWeight: 600, fontSize: '0.9rem', color: '#1A1A2E',
                    margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </h4>
                  {shopName && (
                    <p style={{ color: '#999', fontSize: '0.75rem', margin: '2px 0 0' }}>{shopName}</p>
                  )}
                  {/* Quantity controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        border: '1px solid #ddd', background: 'white',
                        cursor: 'pointer', fontSize: '0.9rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#666',
                      }}
                    >
                      {item.quantity === 1 ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      ) : '−'}
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: '18px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        border: '1px solid #ddd', background: 'white',
                        cursor: 'pointer', fontSize: '0.9rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#666',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price on the right */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1A2E' }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                  {item.quantity > 1 && (
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                      ${item.price.toFixed(2)} each
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tip Selector — hidden for pickup orders (no driver) */}
          {!isPickup && <div style={{
            margin: '12px 16px 0',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f0f0f0',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.1rem' }}>💰</span>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1A2E', margin: 0 }}>
                Add a tip for your driver
              </h3>
            </div>
            <div style={{ margin: '0 0 14px', padding: '14px 16px', background: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', borderRadius: '12px', border: '2px solid #FF8C00', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#E65100', lineHeight: 1.5, marginBottom: 4 }}>
                &#128155; 100% of your tip goes directly to your driver!
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#BF360C', lineHeight: 1.4 }}>
                Your driver works hard to deliver your donuts fresh &amp; fast. Tips make a real difference!
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              {tipOptions.map((opt, idx) => {
                const isSelected = !showCustomTip && selectedTipIndex === idx
                return (
                  <div key={idx} style={{ flex: 1, position: 'relative' }}>
                    {opt.popular && (
                      <div style={{
                        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        background: '#FF8C00', color: 'white',
                        fontSize: '0.65rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}>
                        ★ Most popular
                      </div>
                    )}
                    <button
                      onClick={() => { setSelectedTipIndex(idx); setShowCustomTip(false) }}
                      style={{
                        width: '100%',
                        padding: '14px 4px',
                        borderRadius: '24px',
                        border: isSelected ? '2px solid #FF8C00' : '1.5px solid #e0e0e0',
                        background: isSelected ? '#FFF8F0' : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        fontWeight: 800, fontSize: '1.05rem',
                        color: isSelected ? '#FF8C00' : '#1A1A2E',
                      }}>
                        ${opt.amount.toFixed(0)}
                      </div>
                    </button>
                  </div>
                )
              })}
              <div style={{ flex: 1 }}>
                <button
                  onClick={() => setShowCustomTip(true)}
                  style={{
                    width: '100%',
                    padding: '14px 4px',
                    borderRadius: '24px',
                    border: showCustomTip ? '2px solid #FF8C00' : '1.5px solid #e0e0e0',
                    background: showCustomTip ? '#FFF8F0' : 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    fontWeight: 700, fontSize: '0.9rem',
                    color: showCustomTip ? '#FF8C00' : '#1A1A2E',
                  }}>
                    Other
                  </div>
                </button>
              </div>
            </div>
            {showCustomTip && (
              <div style={{
                marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                background: '#F9F9F9', borderRadius: '12px', padding: '8px 12px',
              }}>
                <span style={{ fontWeight: 600, color: '#666' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '6px 0', border: 'none', background: 'transparent',
                    width: '100%', fontSize: '1rem', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>}

          {/* Order Summary */}
          <div style={{
            margin: '12px 16px 0',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f0f0f0',
            padding: '16px',
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px', color: '#1A1A2E' }}>
              Order Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span style={{ fontWeight: 500, color: '#333' }}>${total.toFixed(2)}</span>
              </div>
              {!isPickup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#666' }}>Delivery Fee</span>
                  <span style={{ fontWeight: 500, color: '#333' }}>${deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => setFeesExpanded(v => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: '0.88rem', fontFamily: 'inherit',
                  }}
                  aria-expanded={feesExpanded}
                >
                  <span style={{ color: '#666', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Fees &amp; Estimated Tax
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, borderRadius: '50%', border: '1px solid #bbb',
                      fontSize: '0.65rem', color: '#888', lineHeight: 1,
                    }}>{feesExpanded ? '−' : 'i'}</span>
                  </span>
                  <span style={{ fontWeight: 500, color: '#333' }}>${(serviceFee + smallOrderFee + tax).toFixed(2)}</span>
                </button>
                {feesExpanded && (
                  <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                        <span>Service Fee</span>
                        <span>${serviceFee.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2, lineHeight: 1.4 }}>
                        Helps cover platform costs — payment processing, customer support, and app operations.
                      </div>
                    </div>
                    {smallOrderFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                        <span>Small Order Fee <span style={{ fontSize: '0.7rem', color: '#aaa' }}>(under ${MIN_ORDER_AMOUNT})</span></span>
                        <span>${smallOrderFee.toFixed(2)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                        <span>Sales Tax</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!isPickup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#666' }}>Tip</span>
                  <span style={{ fontWeight: 500, color: '#333' }}>${tip.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '4px',
              }}>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1A1A2E' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1A1A2E' }}>
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Minimum order warning */}
          {!meetsMinimum && (
            <div style={{
              margin: '12px 16px 0',
              background: '#FFF3CD', borderRadius: '12px', padding: '12px 16px',
              fontSize: '0.85rem', color: '#856404',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>⚠️</span>
              <span>Minimum order is ${shopMinOrder.toFixed(2)}. Add ${(shopMinOrder - total).toFixed(2)} more.</span>
            </div>
          )}

          {/* Desktop Place Order button */}
          <div style={{ padding: '16px' }} className="desktop-only">
            <button
              onClick={() => {
                if (!user) {
                  router.push('/login')
                  return
                }
                if (meetsMinimum) {
                  const params = new URLSearchParams({ tip: String(tip), fulfillment: fulfillmentType })
                  router.push(`/checkout?${params.toString()}`)
                }
              }}
              disabled={!meetsMinimum}
              style={{
                width: '100%',
                padding: '16px',
                background: meetsMinimum ? '#FF8C00' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: meetsMinimum ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (meetsMinimum) e.currentTarget.style.background = '#e67e00' }}
              onMouseLeave={e => { if (meetsMinimum) e.currentTarget.style.background = '#FF8C00' }}
            >
              Place Order &middot; ${grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </main>

      {/* Mobile fixed Place Order button */}
      <div className="mobile-only" style={{
        position: 'fixed',
        bottom: '60px',
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'white',
        borderTop: '1px solid #f0f0f0',
        zIndex: 999,
      }}>
        <button
          onClick={() => {
            if (!user) {
              router.push('/login')
              return
            }
            if (meetsMinimum) {
              const params = new URLSearchParams({ tip: String(tip), fulfillment: fulfillmentType })
              router.push(`/checkout?${params.toString()}`)
            }
          }}
          disabled={!meetsMinimum}
          style={{
            width: '100%',
            padding: '16px',
            background: meetsMinimum ? '#FF8C00' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: meetsMinimum ? 'pointer' : 'not-allowed',
          }}
        >
          Place Order &middot; ${grandTotal.toFixed(2)}
        </button>
      </div>

      {/* Desktop Footer */}
      <div className="desktop-only">
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  )
}
