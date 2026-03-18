'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, MIN_ORDER_AMOUNT } from '@/lib/constants'

export default function CartPage() {
  const router = useRouter()
  const { items, total, count, updateQty, removeItem, clearCart, shopName } = useCart()
  const { user } = useAuth()

  // Tip amounts based on percentages of subtotal
  const tipOptions = [
    { label: '10%', amount: Math.round(total * 0.10 * 100) / 100 },
    { label: '15%', amount: Math.round(total * 0.15 * 100) / 100 },
    { label: '20%', amount: Math.round(total * 0.20 * 100) / 100 },
  ]

  const [selectedTipIndex, setSelectedTipIndex] = useState<number>(1) // default 15%
  const [customTip, setCustomTip] = useState('')
  const [showCustomTip, setShowCustomTip] = useState(false)

  const deliveryFee = count > 0 ? DEFAULT_DELIVERY_FEE : 0
  const serviceFee = total * SERVICE_FEE_RATE
  const tip = showCustomTip
    ? (parseFloat(customTip) || 0)
    : (tipOptions[selectedTipIndex]?.amount ?? 0)
  const grandTotal = total + deliveryFee + serviceFee + tip
  const meetsMinimum = total >= MIN_ORDER_AMOUNT

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
          <Footer />
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
                <div style={{ fontSize: '0.75rem', color: '#999' }}>Delivery 25-35 min</div>
              </div>
            </div>
          )}

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

          {/* Tip Selector */}
          <div style={{
            margin: '12px 16px 0',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f0f0f0',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.1rem' }}>💰</span>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1A2E', margin: 0 }}>
                Add a tip for your driver
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {tipOptions.map((opt, idx) => {
                const isSelected = !showCustomTip && selectedTipIndex === idx
                return (
                  <button
                    key={idx}
                    onClick={() => { setSelectedTipIndex(idx); setShowCustomTip(false) }}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      borderRadius: '24px',
                      border: isSelected ? '2px solid #FF8C00' : '1.5px solid #e0e0e0',
                      background: isSelected ? '#FFF8F0' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontWeight: 700, fontSize: '0.85rem',
                      color: isSelected ? '#FF8C00' : '#1A1A2E',
                    }}>
                      ${opt.amount.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '0.7rem', color: isSelected ? '#FF8C00' : '#999',
                      marginTop: '1px',
                    }}>
                      {opt.label}
                    </div>
                  </button>
                )
              })}
              <button
                onClick={() => setShowCustomTip(true)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  borderRadius: '24px',
                  border: showCustomTip ? '2px solid #FF8C00' : '1.5px solid #e0e0e0',
                  background: showCustomTip ? '#FFF8F0' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  fontWeight: 700, fontSize: '0.85rem',
                  color: showCustomTip ? '#FF8C00' : '#1A1A2E',
                }}>
                  Other
                </div>
              </button>
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
          </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#666' }}>Delivery Fee</span>
                <span style={{ fontWeight: 500, color: '#333' }}>${deliveryFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#666' }}>Service Fee</span>
                <span style={{ fontWeight: 500, color: '#333' }}>${serviceFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#666' }}>Tip</span>
                <span style={{ fontWeight: 500, color: '#333' }}>${tip.toFixed(2)}</span>
              </div>
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
              <span>Minimum order is ${MIN_ORDER_AMOUNT.toFixed(2)}. Add ${(MIN_ORDER_AMOUNT - total).toFixed(2)} more.</span>
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
                  router.push(`/checkout?tip=${tip}`)
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
              router.push(`/checkout?tip=${tip}`)
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
        <Footer />
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  )
}
