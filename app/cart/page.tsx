'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, TIP_OPTIONS, MIN_ORDER_AMOUNT } from '@/lib/constants'

export default function CartPage() {
  const router = useRouter()
  const { items, total, count, updateQty, removeItem, clearCart, shopName } = useCart()
  const { user } = useAuth()
  const [selectedTip, setSelectedTip] = useState<number>(3)
  const [customTip, setCustomTip] = useState('')
  const [showCustomTip, setShowCustomTip] = useState(false)

  const deliveryFee = count > 0 ? DEFAULT_DELIVERY_FEE : 0
  const serviceFee = total * SERVICE_FEE_RATE
  const tip = showCustomTip ? (parseFloat(customTip) || 0) : selectedTip
  const grandTotal = total + deliveryFee + serviceFee + tip
  const meetsMinimum = total >= MIN_ORDER_AMOUNT

  if (count === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '5rem', display: 'block', marginBottom: '1.5rem' }}>🛒</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
              Your cart is empty
            </h1>
            <p style={{ color: '#888', marginBottom: '2rem', fontSize: '1rem' }}>
              Add some delicious donuts to get started!
            </p>
            <Link href="/shops" style={{
              background: '#FF1493', color: 'white', padding: '0.85rem 2rem',
              borderRadius: '10px', fontWeight: 700, display: 'inline-block',
              fontSize: '1rem',
            }}>
              Browse Shops
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '2rem', flexWrap: 'wrap', gap: '0.5rem',
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
                background: 'none', border: '1px solid #ddd', borderRadius: '8px',
                padding: '0.5rem 1rem', color: '#888', fontSize: '0.85rem',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              Clear Cart
            </button>
          </div>

          {/* Cart Items */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            overflow: 'hidden', marginBottom: '1.5rem',
          }}>
            {items.map((item, index) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                borderBottom: index < items.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '10px', flexShrink: 0,
                  background: item.image_url
                    ? `url(${item.image_url}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!item.image_url && <span style={{ fontSize: '1.5rem' }}>🍩</span>}
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A1A2E' }}>{item.name}</h4>
                  <p style={{ color: '#FF1493', fontWeight: 600, fontSize: '0.9rem' }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => updateQty(item.id, item.quantity - 1)}
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      cursor: 'pointer', fontSize: '1rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center', fontSize: '0.95rem' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, item.quantity + 1)}
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: '1px solid #ddd', background: 'white',
                      cursor: 'pointer', fontSize: '1rem', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  style={{
                    background: 'none', border: 'none', color: '#ccc',
                    cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem',
                  }}
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>

          {/* Tip Selector */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.25rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.75rem', color: '#1A1A2E' }}>
              Add a tip for your driver
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TIP_OPTIONS.map(amount => (
                <button
                  key={amount}
                  onClick={() => { setSelectedTip(amount); setShowCustomTip(false) }}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '8px',
                    border: !showCustomTip && selectedTip === amount ? '2px solid #FF1493' : '1px solid #ddd',
                    background: !showCustomTip && selectedTip === amount ? '#FFF0F5' : 'white',
                    color: !showCustomTip && selectedTip === amount ? '#FF1493' : '#1A1A2E',
                    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                  }}
                >
                  ${amount}
                </button>
              ))}
              <button
                onClick={() => setShowCustomTip(true)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px',
                  border: showCustomTip ? '2px solid #FF1493' : '1px solid #ddd',
                  background: showCustomTip ? '#FFF0F5' : 'white',
                  color: showCustomTip ? '#FF1493' : '#1A1A2E',
                  fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                Other
              </button>
            </div>
            {showCustomTip && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #ddd',
                    width: '100px', fontSize: '0.95rem', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.25rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Order Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span style={{ fontWeight: 500 }}>${total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Delivery Fee <span style={{ fontSize: '0.75rem', color: '#aaa' }}>(varies by distance)</span></span>
                <span style={{ fontWeight: 500 }}>${deliveryFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Service Fee</span>
                <span style={{ fontWeight: 500 }}>${serviceFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Tip</span>
                <span style={{ fontWeight: 500 }}>${tip.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem', marginTop: '0.25rem',
              }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A1A2E' }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FF1493' }}>
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {!meetsMinimum && (
            <div style={{
              background: '#FFF3CD', borderRadius: '10px', padding: '0.85rem 1rem',
              marginBottom: '1rem', fontSize: '0.9rem', color: '#856404',
            }}>
              Minimum order amount is ${MIN_ORDER_AMOUNT.toFixed(2)}. Add ${(MIN_ORDER_AMOUNT - total).toFixed(2)} more.
            </div>
          )}

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
              padding: '1rem',
              background: meetsMinimum ? '#FF8C00' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: meetsMinimum ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { if (meetsMinimum) e.currentTarget.style.background = '#e67e00' }}
            onMouseLeave={e => { if (meetsMinimum) e.currentTarget.style.background = '#FF8C00' }}
          >
            Proceed to Checkout
          </button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
