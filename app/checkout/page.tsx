'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SquarePaymentForm from '@/components/SquarePaymentForm'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, SMALL_ORDER_FEE, MIN_ORDER_AMOUNT } from '@/lib/constants'

// Shop timezone (single-shop for now; mirrors SHOP_TZ in lib/shop-hours.ts).
const SHOP_TZ = 'America/Chicago'

// Convert a shop-local wall-clock (date "YYYY-MM-DD" + time "HH:MM") to a UTC
// ISO instant, DST-aware, without a date library. Treat the wall time as if it
// were UTC, then subtract the shop's actual UTC offset at that instant.
function shopLocalToISO(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  const asIfUTC = Date.UTC(y, mo - 1, d, h, mi)
  // Offset (ms) between the shop timezone and UTC at that instant.
  const probe = new Date(asIfUTC)
  const shopWall = new Date(probe.toLocaleString('en-US', { timeZone: SHOP_TZ }))
  const utcWall = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = shopWall.getTime() - utcWall.getTime()
  return new Date(asIfUTC - offset).toISOString()
}

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const tipParam = parseFloat(searchParams.get('tip') || '3')
  const fulfillmentParam: 'delivery' | 'pickup' = searchParams.get('fulfillment') === 'pickup' ? 'pickup' : 'delivery'
  const { items, total, count, shopId, shopName } = useCart()
  const { user, supabase, refreshUser } = useAuth()

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
  const [hoursInfo, setHoursInfo] = useState<{
    open: boolean
    message: string
    schedule: { day_of_week: number; open_time: string; close_time: string; is_closed: boolean }[]
    nextOpen: { date: string; time: string; label: string } | null
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [shopFees, setShopFees] = useState({ service_fee_pct: SERVICE_FEE_RATE * 100, delivery_fee: DEFAULT_DELIVERY_FEE, tax_rate: 0 })
  const [shopAddress, setShopAddress] = useState<{ address: string; city: string; state: string; zip: string } | null>(null)
  // Distance-based delivery fee quoted from the entered address (matches what
  // the server will charge). Null until we have a full address to quote.
  const [quote, setQuote] = useState<{ deliveryFee: number; distanceMiles: number; inRange: boolean; etaLabel?: string } | null>(null)
  const [feesExpanded, setFeesExpanded] = useState(false)
  // Guest checkout (anonymous session). Collected on the sign-in gate below.
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestError, setGuestError] = useState('')
  // Stable per-attempt idempotency key: if a response is lost after the card is
  // charged, the retry carries the same key so the server/Square de-dupe it
  // (no double charge). Regenerated only after a server-returned error, where
  // no charge went through and a fresh attempt is what the customer wants.
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID())
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

  // Quote the distance-based delivery fee whenever the delivery address is
  // complete, so the total shown matches what the server will charge.
  useEffect(() => {
    if (isPickup || !shopId || !address.trim() || !city.trim() || !zip.trim()) { setQuote(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/delivery-quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ shopId, address, city }),
      })
        .then(r => r.json())
        .then(d => { if (d.located) setQuote({ deliveryFee: d.deliveryFee, distanceMiles: d.distanceMiles, inRange: d.inRange, etaLabel: d.etaLabel }) })
        .catch(() => {})
    }, 600)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [isPickup, shopId, address, city, zip])

  // Shop hours: if the shop is closed right now, we can't take an ASAP order —
  // so we flip the customer into "schedule for later" and pre-fill the next
  // opening slot instead of dead-ending them.
  useEffect(() => {
    if (!shopId) return
    fetch(`/api/shops/${shopId}/hours`)
      .then(r => r.json())
      .then(data => {
        if (!data || typeof data.open !== 'boolean') return
        setHoursInfo(data)
        if (data.open === false && data.nextOpen) {
          setDeliveryTiming('scheduled')
          setScheduledDate(data.nextOpen.date)
          setScheduledTime(data.nextOpen.time)
        }
      })
      .catch(() => {})
  }, [shopId])

  const isClosedNow = hoursInfo?.open === false
  const hasHours = !!hoursInfo?.schedule?.length

  // 30-min slots that fall inside a given date's open window. When no hours are
  // configured, fall back to the full 6 AM–9 PM range.
  const slotsForDate = (dateStr: string): { value: string; label: string }[] => {
    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60), m = mins % 60
      const ampm = h >= 12 ? 'PM' : 'AM'
      const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
      return { value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, label: `${dh}:${m.toString().padStart(2, '0')} ${ampm}` }
    }
    if (!hasHours) return Array.from({ length: 31 }, (_, i) => fmt(6 * 60 + i * 30))
    if (!dateStr) return []
    const dow = new Date(`${dateStr}T12:00:00`).getDay()
    const dh = hoursInfo!.schedule.find(h => h.day_of_week === dow)
    if (!dh || dh.is_closed) return []
    const [oh, om] = dh.open_time.split(':').map(Number)
    const [ch, cm] = dh.close_time.split(':').map(Number)
    let start = oh * 60 + om
    const end = ch * 60 + cm
    // Don't offer past slots for today.
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    if (dateStr === todayStr) {
      const nowMins = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30
      start = Math.max(start, nowMins)
    }
    const slots: { value: string; label: string }[] = []
    for (let t = start; t < end; t += 30) slots.push(fmt(t))
    return slots
  }

  // Date choices: next 8 days, limited to days the shop is actually open.
  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { value, label }
  }).filter(opt => (!hasHours ? true : slotsForDate(opt.value).length > 0))

  const timeOptions = slotsForDate(scheduledDate)

  // Dead-end guard: the shop is closed now AND has no bookable slot in the next
  // 8 days (every day closed / hours misconfigured). ASAP is disabled and the
  // date picker would be empty, so show a clear "not accepting orders" state
  // and block checkout instead of trapping the customer at an empty dropdown.
  const cannotOrder = isClosedNow && hasHours && dateOptions.length === 0

  // Keep the selected time valid when the date (or hours) change: if the current
  // pick isn't a real slot for the chosen day, snap to the first available one.
  useEffect(() => {
    if (deliveryTiming !== 'scheduled' || !scheduledDate) return
    const slots = slotsForDate(scheduledDate)
    if (slots.length && !slots.some(s => s.value === scheduledTime)) {
      setScheduledTime(slots[0].value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledDate, hoursInfo, deliveryTiming])

  const deliveryFee = isPickup ? 0 : (quote?.deliveryFee ?? shopFees.delivery_fee)
  const serviceFee = Math.round(total * (shopFees.service_fee_pct / 100) * 100) / 100
  const smallOrderFee = total < MIN_ORDER_AMOUNT ? SMALL_ORDER_FEE : 0
  // TX Comptroller Rule 3.293: separately-stated delivery + service fees on
  // prepared-food sales are part of the taxable base. Tip is excluded.
  const tax = Math.round((total + deliveryFee + serviceFee + smallOrderFee) * (shopFees.tax_rate / 100) * 100) / 100
  const tip = isPickup ? 0 : tipParam

  const promoDiscount = promo?.discount || 0
  const grandTotal = Math.round((total + tax + deliveryFee + serviceFee + smallOrderFee + tip - promoDiscount) * 100) / 100

  // Build ISO datetime for the scheduled slot. The picker shows the shop's
  // hours in SHOP-local time, so the chosen "8:00 AM" means 8:00 at the shop —
  // interpret it in the shop timezone, NOT the customer's browser timezone, or
  // an out-of-state customer would book an instant that maps to a different
  // (possibly closed) shop-local time. Mirrors SHOP_TZ in lib/shop-hours.ts.
  const scheduledFor = deliveryTiming === 'scheduled' && scheduledDate && scheduledTime
    ? shopLocalToISO(scheduledDate, scheduledTime)
    : null

  const handleContinueAsGuest = async () => {
    if (!guestName.trim()) { setGuestError('Please enter your name.'); return }
    if (!guestPhone.trim()) { setGuestError('Please enter a phone number so we can reach you about your order.'); return }
    setGuestSubmitting(true)
    setGuestError('')
    try {
      // A real but anonymous Supabase session — this makes the guest
      // "authenticated" so the normal checkout, payment and order-tracking
      // flow (and RLS) all work with no separate guest code path.
      const { error: anonErr } = await supabase.auth.signInAnonymously()
      if (anonErr) {
        setGuestError('Guest checkout is unavailable right now. Please sign in instead.')
        return
      }
      // Provision their dd_users profile from the name/phone they entered.
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName.trim(), phone: guestPhone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGuestError(data.error || 'Could not start guest checkout. Please try again.')
        return
      }
      // Force the auth context to re-read /api/me so `user` becomes set and the
      // full checkout form renders (guestEmail stays in state for the receipt).
      await refreshUser()
    } catch {
      setGuestError('Something went wrong. Please try again.')
    } finally {
      setGuestSubmitting(false)
    }
  }

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
    const guestInput = {
      width: '100%', padding: '0.85rem 1rem', borderRadius: '10px',
      border: '1px solid #ddd', fontSize: '1rem', outline: 'none',
    } as const
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 460, margin: '0 auto', padding: '2.5rem 1.25rem 4rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem', color: '#1A1A2E', textAlign: 'center' }}>
            Almost there!
          </h1>
          <p style={{ color: '#888', marginBottom: '1.75rem', textAlign: 'center' }}>
            Check out as a guest — no account needed. Just tell us where to reach you about your order.
          </p>

          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f0f0f0', padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>Name</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name" style={guestInput}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>Mobile phone</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="(903) 555-1234" style={guestInput}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                <p style={{ fontSize: '0.75rem', color: '#999', margin: '0.35rem 0 0' }}>So the shop and driver can reach you about your order.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
                  Email <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="you@example.com" style={guestInput}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                <p style={{ fontSize: '0.75rem', color: '#999', margin: '0.35rem 0 0' }}>For your emailed receipt.</p>
              </div>

              {guestError && (
                <p style={{ color: '#DC2626', fontSize: '0.85rem', margin: 0 }}>{guestError}</p>
              )}

              <button
                type="button"
                onClick={handleContinueAsGuest}
                disabled={guestSubmitting}
                style={{
                  width: '100%', padding: '0.95rem', borderRadius: 12, border: 'none',
                  background: guestSubmitting ? '#ccc' : '#FF1493', color: 'white',
                  fontWeight: 700, fontSize: '1.02rem', cursor: guestSubmitting ? 'wait' : 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                {guestSubmitting ? 'One moment…' : 'Continue as guest'}
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', marginTop: '1.5rem' }}>
            Have an account?{' '}
            <Link href="/login" style={{ color: '#FF1493', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  const handleTokenize = async (token: string) => {
    if (isClosedNow && deliveryTiming === 'asap') {
      setError(`${shopName || 'This shop'} is closed right now — please schedule your order for later.`)
      return
    }
    if (deliveryTiming === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      setError('Please choose a date and time for your order.')
      return
    }
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
      if (quote && !quote.inRange) {
        setError(`Sorry, that address is outside the delivery range (${quote.distanceMiles} mi). Please choose a closer address.`)
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
      // Plain street (no unit) for server-side geocoding — matches the quote.
      delivery_street: isPickup ? null : address,
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
      sourceId: token,
      idempotencyKey: checkoutKey,
      // Guests: the email they entered on the gate, for their receipt. Empty
      // for logged-in customers (server falls back to their account email).
      customer_email: guestEmail.trim() || null,
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Payment failed. Please try again.')
        // The server responded with an error, so no charge went through —
        // start the next attempt with a fresh key (a reused key would make
        // Square replay the same decline instead of trying the fixed card).
        setCheckoutKey(crypto.randomUUID())
        return
      }
      if (data.orderId) {
        window.location.href = `/checkout/success?order_id=${data.orderId}`
      }
    } catch {
      // No response — the charge outcome is unknown. Keep the same key so a
      // retry is de-duped rather than double-charged.
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
            {!isPickup && !isClosedNow && deliveryTiming === 'asap' && quote?.etaLabel && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
                padding: '0.7rem 0.95rem', marginBottom: '1rem', fontSize: '0.92rem', color: '#166534', fontWeight: 600,
              }}>
                <span style={{ fontSize: '1.1rem' }}>🚴</span>
                Estimated arrival: about {quote.etaLabel}
                <span style={{ fontWeight: 400, color: '#4B9A6B', fontSize: '0.8rem' }}>({quote.distanceMiles} mi away)</span>
              </div>
            )}
            {cannotOrder ? (
              <div style={{
                display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
                padding: '0.85rem 1rem',
              }}>
                <span style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>🚫</span>
                <div style={{ fontSize: '0.9rem', color: '#991B1B', lineHeight: 1.45 }}>
                  <strong>{shopName || 'This shop'} isn{"’"}t accepting orders right now.</strong>{' '}
                  {hoursInfo?.message || 'Please check back during their open hours.'}
                </div>
              </div>
            ) : (
            <>
            {isClosedNow && (
              <div style={{
                display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                background: '#FFF8F0', border: '1px solid #FFD8A8', borderRadius: '10px',
                padding: '0.85rem 1rem', marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>🌙</span>
                <div style={{ fontSize: '0.9rem', color: '#8A5A00', lineHeight: 1.45 }}>
                  <strong style={{ color: '#B45309' }}>{shopName || 'This shop'} is closed right now.</strong>{' '}
                  {hoursInfo?.nextOpen
                    ? <>You can schedule your order — it{"’"}ll be ready {hoursInfo.nextOpen.label}.</>
                    : <>{hoursInfo?.message || 'Please schedule your order for later.'}</>}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: deliveryTiming === 'scheduled' ? '1rem' : 0 }}>
              <button
                type="button"
                disabled={isClosedNow}
                onClick={() => !isClosedNow && setDeliveryTiming('asap')}
                title={isClosedNow ? 'The shop is closed right now' : undefined}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                  border: deliveryTiming === 'asap' ? '2px solid #FF8C00' : '1px solid #ddd',
                  background: isClosedNow ? '#F5F5F5' : deliveryTiming === 'asap' ? '#FFF8F0' : 'white',
                  color: isClosedNow ? '#BBB' : deliveryTiming === 'asap' ? '#FF8C00' : '#333',
                  fontWeight: 600, fontSize: '0.95rem', cursor: isClosedNow ? 'not-allowed' : 'pointer',
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
            </>
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
                  <span style={{ color: '#666' }}>Delivery Fee {quote?.distanceMiles != null && <span style={{ fontSize: '0.7rem', color: '#aaa' }}>({quote.distanceMiles} mi)</span>}</span>
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

          <SquarePaymentForm
            total={grandTotal}
            loading={submitting}
            disabled={cannotOrder}
            onError={setError}
            onTokenize={handleTokenize}
          />
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
            🔒 Secure payment · powered by Square
          </p>
        </div>
      </main>
    </div>
  )
}
