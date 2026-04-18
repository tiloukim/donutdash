'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE } from '@/lib/constants'

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const tipParam = parseFloat(searchParams.get('tip') || '3')
  const { items, total, count, shopId, shopName } = useCart()
  const { user } = useAuth()

  const [address, setAddress] = useState('')
  const [apt, setApt] = useState('')
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [gateCode, setGateCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('TX')
  const [zip, setZip] = useState('')
  const [instructions, setInstructions] = useState('')
  const [deliveryTiming, setDeliveryTiming] = useState<'asap' | 'scheduled'>('asap')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'square' | 'paypal'>('square')
  const [shopFees, setShopFees] = useState({ service_fee_pct: SERVICE_FEE_RATE * 100, delivery_fee: DEFAULT_DELIVERY_FEE, tax_rate: 0 })

  // Promo code state
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoApplied, setPromoApplied] = useState<{
    code: string
    discount_type: 'percent' | 'fixed' | 'free_delivery'
    discount_value: number
    description: string
    min_order: number
    max_discount: number | null
  } | null>(null)

  useEffect(() => {
    if (!shopId) return
    fetch(`/api/shops/${shopId}`)
      .then(r => r.json())
      .then(data => {
        const s = data?.shop || data
        if (s && s.service_fee_pct !== undefined) {
          setShopFees({
            service_fee_pct: s.service_fee_pct,
            delivery_fee: s.delivery_fee,
            tax_rate: s.tax_rate || 0,
          })
        }
      })
      .catch(() => {})
  }, [shopId])

  const deliveryFee = shopFees.delivery_fee
  const serviceFee = Math.round(total * (shopFees.service_fee_pct / 100) * 100) / 100
  const tax = Math.round(total * (shopFees.tax_rate / 100) * 100) / 100
  const tip = tipParam

  // Calculate promo discount
  let promoDiscount = 0
  if (promoApplied) {
    if (promoApplied.discount_type === 'percent') {
      promoDiscount = Math.round(total * (promoApplied.discount_value / 100) * 100) / 100
      if (promoApplied.max_discount && promoDiscount > promoApplied.max_discount) {
        promoDiscount = promoApplied.max_discount
      }
    } else if (promoApplied.discount_type === 'fixed') {
      promoDiscount = promoApplied.discount_value
    } else if (promoApplied.discount_type === 'free_delivery') {
      promoDiscount = deliveryFee
    }
  }

  const grandTotal = Math.round((total + tax + deliveryFee + serviceFee + tip - promoDiscount) * 100) / 100

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) {
      setPromoError('Please enter a promo code')
      return
    }
    setPromoLoading(true)
    setPromoError('')
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promo code')
        setPromoApplied(null)
        return
      }
      if (data.min_order && total < data.min_order) {
        setPromoError(`Minimum order of $${data.min_order.toFixed(2)} required`)
        setPromoApplied(null)
        return
      }
      setPromoApplied({
        code: promoInput.trim().toUpperCase(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        description: data.description,
        min_order: data.min_order,
        max_discount: data.max_discount,
      })
      setPromoError('')
    } catch {
      setPromoError('Failed to validate promo code')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoApplied(null)
    setPromoInput('')
    setPromoError('')
  }

  // Generate date options: today + next 6 days
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { value, label }
  })

  // Generate 30-min time slots from 6:00 AM to 9:00 PM
  const timeOptions = Array.from({ length: 31 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 30
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
    const label = `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
    const value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    return { value, label }
  })

  // Build ISO datetime for scheduled delivery
  const scheduledFor = deliveryTiming === 'scheduled' && scheduledDate && scheduledTime
    ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
    : null

  if (count === 0) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🛒</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cart is empty</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>Add items to your cart before checking out.</p>
          <Link href="/shops" style={{
            background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '10px', fontWeight: 600, display: 'inline-block',
          }}>
            Browse Shops
          </Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sign in required</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>Please sign in to complete your order.</p>
          <Link href="/login" style={{
            background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '10px', fontWeight: 600, display: 'inline-block',
          }}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      setError('Please enter a delivery address.')
      return
    }
    if (!city.trim()) {
      setError('Please enter a city.')
      return
    }
    if (!zip.trim()) {
      setError('Please enter a ZIP code.')
      return
    }

    setSubmitting(true)
    setError('')

    const orderPayload = {
      shopId,
      items: items.map(i => ({
        menu_item_id: i.id.split('::')[0],
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image_url: i.image_url,
        special_instructions: i.special_instructions,
      })),
      delivery_address: [address, apt && `Apt ${apt}`, building && `Bldg ${building}`, floor && `Floor ${floor}`].filter(Boolean).join(', '),
      delivery_city: city,
      delivery_instructions: [gateCode && `Gate code: ${gateCode}`, instructions].filter(Boolean).join('. ') || null,
      tip,
      promo_code: promoApplied?.code || null,
      promo_discount: promoDiscount || 0,
      scheduled_for: scheduledFor,
    }

    try {
      if (paymentMethod === 'paypal') {
        // PayPal checkout
        const res = await fetch('/api/paypal/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to create PayPal checkout.')
          return
        }
        if (data.approveUrl) {
          window.location.href = data.approveUrl
        }
      } else {
        // Square checkout
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to create checkout session.')
          return
        }
        if (data.url) {
          window.location.href = data.url
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '2rem' }}>
            Checkout
          </h1>

          {/* Delivery Address */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Delivery Address
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Street address"
                value={address}
                onChange={e => setAddress(e.target.value)}
                style={{
                  padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                  fontSize: '0.95rem', outline: 'none', width: '100%',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Apt #"
                  value={apt}
                  onChange={e => setApt(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
                <input
                  type="text"
                  placeholder="Building #"
                  value={building}
                  onChange={e => setBuilding(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
                <input
                  type="text"
                  placeholder="Floor #"
                  value={floor}
                  onChange={e => setFloor(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
                <input
                  type="text"
                  placeholder="Gate code"
                  value={gateCode}
                  onChange={e => setGateCode(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
                <input
                  type="text"
                  placeholder="State"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
                <input
                  type="text"
                  placeholder="ZIP"
                  value={zip}
                  onChange={e => setZip(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                    fontSize: '0.95rem', outline: 'none', width: '100%',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
              </div>
              <textarea
                placeholder="Delivery instructions (optional)"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={2}
                style={{
                  padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                  fontSize: '0.95rem', outline: 'none', width: '100%',
                  resize: 'vertical', fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
              />
            </div>
          </div>

          {/* Promo Code */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Promo Code
            </h3>
            {promoApplied ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#FFF0F5', border: '1px solid #FF1493', borderRadius: '10px',
                padding: '0.75rem 1rem',
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#FF1493', fontSize: '0.95rem' }}>
                    {promoApplied.code}
                  </span>
                  <span style={{ color: '#333', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                    — {promoApplied.description}
                  </span>
                </div>
                <button
                  onClick={handleRemovePromo}
                  style={{
                    background: 'none', border: 'none', color: '#FF1493',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value); setPromoError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyPromo() }}
                    style={{
                      flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                      border: promoError ? '1px solid #dc3545' : '1px solid #ddd',
                      fontSize: '0.95rem', outline: 'none', textTransform: 'uppercase',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                    onBlur={e => (e.currentTarget.style.borderColor = promoError ? '#dc3545' : '#ddd')}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading}
                    style={{
                      background: '#FF1493', color: 'white', border: 'none',
                      borderRadius: '10px', padding: '0.75rem 1.25rem',
                      fontWeight: 600, fontSize: '0.95rem',
                      cursor: promoLoading ? 'not-allowed' : 'pointer',
                      opacity: promoLoading ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {promoLoading ? '...' : 'Apply'}
                  </button>
                </div>
                {promoError && (
                  <p style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
                    {promoError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Delivery Time */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Delivery Time
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: deliveryTiming === 'scheduled' ? '1rem' : 0 }}>
              <button
                type="button"
                onClick={() => setDeliveryTiming('asap')}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                  border: deliveryTiming === 'asap' ? '2px solid #FF8C00' : '1px solid #ddd',
                  background: deliveryTiming === 'asap' ? '#FFF8F0' : 'white',
                  color: deliveryTiming === 'asap' ? '#FF8C00' : '#333',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ASAP
              </button>
              <button
                type="button"
                onClick={() => setDeliveryTiming('scheduled')}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                  border: deliveryTiming === 'scheduled' ? '2px solid #FF8C00' : '1px solid #ddd',
                  background: deliveryTiming === 'scheduled' ? '#FFF8F0' : 'white',
                  color: deliveryTiming === 'scheduled' ? '#FF8C00' : '#333',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Schedule for Later
              </button>
            </div>
            {deliveryTiming === 'scheduled' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.35rem', fontWeight: 500 }}>
                    Date
                  </label>
                  <select
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    style={{
                      width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                      border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                      background: 'white', cursor: 'pointer', appearance: 'auto',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                  >
                    <option value="">Select date</option>
                    {dateOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.35rem', fontWeight: 500 }}>
                    Time
                  </label>
                  <select
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    style={{
                      width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                      border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                      background: 'white', cursor: 'pointer', appearance: 'auto',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                  >
                    <option value="">Select time</option>
                    {timeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Order Summary {shopName && <span style={{ fontWeight: 400, color: '#888', fontSize: '0.9rem' }}>from {shopName}</span>}
            </h3>

            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0', fontSize: '0.9rem',
              }}>
                <span>
                  <span style={{ fontWeight: 600 }}>{item.quantity}x</span>{' '}
                  {item.name}
                </span>
                <span style={{ fontWeight: 500 }}>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#666' }}>Tax ({shopFees.tax_rate}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#666' }}>Delivery Fee <span style={{ fontSize: '0.7rem', color: '#aaa' }}>(based on distance)</span></span>
                <span>${deliveryFee.toFixed(2)}*</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#666' }}>Service Fee</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#666' }}>Tip</span>
                <span>${tip.toFixed(2)}</span>
              </div>
              {promoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#FF1493', fontWeight: 600 }}>Promo ({promoApplied?.code})</span>
                  <span style={{ color: '#FF1493', fontWeight: 600 }}>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem', marginTop: '0.5rem',
              }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#FF1493' }}>
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            *Delivery fee is calculated based on distance from shop to your address. Final amount determined at order placement.
          </p>

          {/* Payment method selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem', color: '#1A1A2E' }}>
              Payment Method
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('square')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: paymentMethod === 'square' ? '2px solid #FF8C00' : '1.5px solid #ddd',
                  background: paymentMethod === 'square' ? '#FFF8F0' : '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>💳</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: paymentMethod === 'square' ? '#FF8C00' : '#1A1A2E' }}>
                    Credit / Debit
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>Via Square</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: paymentMethod === 'paypal' ? '2px solid #0070BA' : '1.5px solid #ddd',
                  background: paymentMethod === 'paypal' ? '#F0F7FF' : '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>🅿️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: paymentMethod === 'paypal' ? '#0070BA' : '#1A1A2E' }}>
                    PayPal / Venmo
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>Pay with PayPal</div>
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#F8D7DA', borderRadius: '10px', padding: '0.85rem 1rem',
              marginBottom: '1rem', fontSize: '0.9rem', color: '#721C24',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={submitting}
            style={{
              width: '100%', padding: '1rem',
              background: submitting ? '#ccc' : paymentMethod === 'paypal' ? '#0070BA' : '#FF8C00',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '1.05rem', fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Processing...'
              : paymentMethod === 'paypal'
                ? `Pay with PayPal - $${grandTotal.toFixed(2)}`
                : `Place Order - $${grandTotal.toFixed(2)}`
            }
          </button>
        </div>
      </main>
    </div>
  )
}
