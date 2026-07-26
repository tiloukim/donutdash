'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, SMALL_ORDER_FEE, MIN_ORDER_AMOUNT } from '@/lib/constants'

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const tipParam = parseFloat(searchParams.get('tip') || '3')
  const fulfillmentParam: 'delivery' | 'pickup' = searchParams.get('fulfillment') === 'pickup' ? 'pickup' : 'delivery'
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
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe')
  const [shopFees, setShopFees] = useState({ service_fee_pct: SERVICE_FEE_RATE * 100, delivery_fee: DEFAULT_DELIVERY_FEE, tax_rate: 0 })
  const [shopAddress, setShopAddress] = useState<{ address: string; city: string; state: string; zip: string } | null>(null)
  const [feesExpanded, setFeesExpanded] = useState(false)
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>(fulfillmentParam)
  const isPickup = fulfillmentType === 'pickup'

  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<{ code: string; discount: number; label: string } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [promoChecking, setPromoChecking] = useState(false)

  // Auto-apply the platform welcome offer for new customers. The server decides
  // eligibility + amount; an empty code just probes for the auto discount.
  useEffect(() => {
    if (!user || total <= 0) return
    let cancelled = false
    fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal: total }),
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.valid) {
          setPromo({ code: data.code, discount: data.discount, label: data.label })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, total])

  const applyPromo = async () => {
    const code = promoInput.trim()
    if (!code) return
    setPromoError('')
    setPromoChecking(true)
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtotal: total, code }),
      })
      const data = await res.json()
      if (data?.valid) {
        setPromo({ code: data.code, discount: data.discount, label: data.label })
        setPromoError('')
      } else {
        setPromoError(data?.error || 'That code isn’t valid for this order.')
      }
    } catch {
      setPromoError('Could not check that code. Please try again.')
    } finally {
      setPromoChecking(false)
    }
  }

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
        if (s && s.address) {
          setShopAddress({
            address: s.address || '',
            city: s.city || '',
            state: s.state || '',
            zip: s.zip || '',
          })
        }
      })
      .catch(() => {})
  }, [shopId])

  const deliveryFee = isPickup ? 0 : shopFees.delivery_fee
  const serviceFee = Math.round(total * (shopFees.service_fee_pct / 100) * 100) / 100
  const smallOrderFee = total < MIN_ORDER_AMOUNT ? SMALL_ORDER_FEE : 0
  // TX Comptroller Rule 3.293: separately-stated delivery + service fees on
  // prepared-food sales are part of the taxable base. Tip is excluded.
  const tax = Math.round((total + deliveryFee + serviceFee + smallOrderFee) * (shopFees.tax_rate / 100) * 100) / 100
  const tip = isPickup ? 0 : tipParam

  const promoDiscount = promo?.discount || 0
  const grandTotal = Math.round((total + tax + deliveryFee + serviceFee + smallOrderFee + tip - promoDiscount) * 100) / 100

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
    if (!isPickup) {
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
    }

    setSubmitting(true)
    setError('')

    const orderPayload = {
      shopId,
      fulfillment_type: fulfillmentType,
      items: items.map(i => ({
        menu_item_id: i.id.split('::')[0],
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image_url: i.image_url,
        special_instructions: i.special_instructions,
      })),
      delivery_address: isPickup
        ? null
        : [address, apt && `Apt ${apt}`, building && `Bldg ${building}`, floor && `Floor ${floor}`].filter(Boolean).join(', '),
      delivery_city: isPickup ? null : city,
      delivery_instructions: isPickup
        ? null
        : ([gateCode && `Gate code: ${gateCode}`, instructions].filter(Boolean).join('. ') || null),
      tip,
      // Display values only — every checkout route recomputes the discount
      // server-side from the real subtotal, so these can't lower the charge.
      promo_code: promo?.code || null,
      promo_discount: promo?.discount || 0,
      scheduled_for: scheduledFor,
    }

    try {
      if (paymentMethod === 'paypal') {
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
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to create checkout.')
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

          {/* Fulfillment toggle */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              How would you like your order?
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                style={{
                  flex: 1, padding: '0.85rem 1rem', borderRadius: '10px',
                  border: !isPickup ? '2px solid #FF1493' : '1px solid #ddd',
                  background: !isPickup ? '#FFF0F7' : 'white',
                  color: !isPickup ? '#FF1493' : '#333',
                  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🚗 Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                style={{
                  flex: 1, padding: '0.85rem 1rem', borderRadius: '10px',
                  border: isPickup ? '2px solid #FF1493' : '1px solid #ddd',
                  background: isPickup ? '#FFF0F7' : 'white',
                  color: isPickup ? '#FF1493' : '#333',
                  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🏪 Pickup
              </button>
            </div>
            {isPickup && shopAddress && (
              <div style={{
                marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '10px',
                background: '#FFF8F0', border: '1px solid #FFE8D6', fontSize: '0.9rem', color: '#444',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#1A1A2E' }}>
                  Pick up at {shopName || 'the shop'}
                </div>
                <div>{shopAddress.address}</div>
                <div>{[shopAddress.city, shopAddress.state, shopAddress.zip].filter(Boolean).join(', ')}</div>
                <div style={{ marginTop: 6, color: '#888', fontSize: '0.82rem' }}>
                  No delivery fee. The shop will let you know when it&apos;s ready.
                </div>
              </div>
            )}
          </div>

          {/* Delivery Address — only shown for delivery orders */}
          {!isPickup && <div style={{
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
          </div>}

          {/* Promo Code */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Promo Code
            </h3>
            {promo ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.85rem 1rem', borderRadius: '10px',
                background: '#ECFDF5', border: '1px solid #A7F3D0',
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#065F46', fontSize: '0.95rem' }}>
                    {promo.code} applied
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#10B981' }}>
                    {promo.label} — you save ${promo.discount.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setPromo(null); setPromoInput(''); setPromoError('') }}
                  style={{
                    background: 'none', border: 'none', color: '#065F46',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo() } }}
                    style={{
                      flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #ddd',
                      fontSize: '0.95rem', outline: 'none', textTransform: 'uppercase',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoChecking || !promoInput.trim()}
                    style={{
                      padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none',
                      background: promoChecking || !promoInput.trim() ? '#ccc' : '#1A1A2E',
                      color: 'white', fontWeight: 700, fontSize: '0.95rem',
                      cursor: promoChecking || !promoInput.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {promoChecking ? '...' : 'Apply'}
                  </button>
                </div>
                {promoError && (
                  <p style={{ fontSize: '0.82rem', color: '#DC2626', marginTop: '0.5rem', marginBottom: 0 }}>
                    {promoError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* When */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              {isPickup ? 'Pickup Time' : 'Delivery Time'}
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
              {!isPickup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#666' }}>Delivery Fee <span style={{ fontSize: '0.7rem', color: '#aaa' }}>(base — +$1.50/mi after 1 mi)</span></span>
                  <span>${deliveryFee.toFixed(2)}*</span>
                </div>
              )}
              <div style={{ marginBottom: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setFeesExpanded(v => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: '0.9rem', fontFamily: 'inherit',
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
                  <span>${(serviceFee + smallOrderFee + tax).toFixed(2)}</span>
                </button>
                {feesExpanded && (
                  <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#888' }}>
                        <span>Service Fee</span>
                        <span>${serviceFee.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 2, lineHeight: 1.4 }}>
                        Helps cover platform costs — payment processing, customer support, and app operations.
                      </div>
                    </div>
                    {smallOrderFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#888' }}>
                        <span>Small Order Fee <span style={{ fontSize: '0.7rem', color: '#aaa' }}>(under ${MIN_ORDER_AMOUNT})</span></span>
                        <span>${smallOrderFee.toFixed(2)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#888' }}>
                        <span>Sales Tax ({shopFees.tax_rate}%)</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!isPickup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#666' }}>Tip</span>
                  <span>${tip.toFixed(2)}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem', color: '#10B981', fontWeight: 600 }}>
                  <span>{promo?.label || 'Promo discount'}</span>
                  <span>−${promoDiscount.toFixed(2)}</span>
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

          {!isPickup && (
            <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '1rem', marginTop: '-0.5rem' }}>
              *Delivery fee is calculated based on distance from shop to your address. Final amount determined at order placement.
            </p>
          )}

          {/* Payment method — auto-selected, no selector shown */}

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
              background: submitting ? '#ccc' : '#FF8C00',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '1.05rem', fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Processing...' : `Place Order – $${grandTotal.toFixed(2)}`}
          </button>
        </div>
      </main>
    </div>
  )
}
