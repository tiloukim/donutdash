'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Order = {
  id: string
  order_number: string
  status: string
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

type Supplier = {
  name: string
  website: string
  categories: string[]
  description: string
  icon: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SUPPLIERS: Supplier[] = [
  {
    name: 'Dawn Foods',
    website: 'dawnfoods.com',
    categories: ['Mixes', 'Glazes', 'Fillings', 'Icings', 'Frozen Dough'],
    description: 'Global bakery supplier with 100+ years, partnering with bakers in 70+ countries.',
    icon: '🌅',
  },
  {
    name: 'BakeMark',
    website: 'bakemark.com',
    categories: ['Full Bakery Line', 'Mixes', 'Fillings', 'Icings', 'Chocolate'],
    description: 'Largest bakery distributor in North America with 38 distribution centers.',
    icon: '⭐',
  },
  {
    name: 'Texas Bakery Supply',
    website: 'texasbakerysupply.com',
    categories: ['Donut Supplies', 'Equipment', 'Packaging'],
    description: 'Regional Texas supplier specializing in donut shop supplies and equipment.',
    icon: '🤠',
  },
  {
    name: 'Sunrise Bakery Supply',
    website: 'sunrisebakerysupply.com',
    categories: ['Bakery Ingredients', 'Supplies'],
    description: 'Full-service bakery supply company.',
    icon: '🌄',
  },
  {
    name: 'Smithfield Foods',
    website: 'smithfieldfoods.com',
    categories: ['Shortening', 'Oils', 'Lard'],
    description: 'Major food company supplying frying oils and shortening for commercial bakeries.',
    icon: '🏭',
  },
  {
    name: 'Bakers Authority',
    website: 'bakersauthority.com',
    categories: ['Ingredients', 'Tools', 'Packaging'],
    description: 'Wholesale baking supplies with over 6,000 products from ingredients to packaging.',
    icon: '🎖️',
  },
  {
    name: 'Stover & Company',
    website: 'stovercompany.com',
    categories: ['Chocolate', 'Mixes', 'Flour', 'Sugar', 'Packaging'],
    description: 'Fourth generation family-owned distributor since 1948 with 2,000+ products.',
    icon: '🍫',
  },
  {
    name: "Rich's",
    website: 'richsusa.com',
    categories: ['Frozen Donuts', 'Toppings', 'Icings', 'Whipped Toppings'],
    description: 'Frozen bakery products and toppings for foodservice and retail.',
    icon: '❄️',
  },
  {
    name: 'PastryStar',
    website: 'pastrystar.com',
    categories: ['Specialty Ingredients', 'Fillings', 'Pastry'],
    description: 'Specialty manufacturer of premium pastry and bakery ingredients.',
    icon: '⭐',
  },
]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#FEF9C3', color: '#854D0E' },
  confirmed:  { bg: '#DBEAFE', color: '#1E40AF' },
  processing: { bg: '#FFEDD5', color: '#9A3412' },
  shipped:    { bg: '#F3E8FF', color: '#6B21A8' },
  delivered:  { bg: '#DCFCE7', color: '#166534' },
  cancelled:  { bg: '#FEE2E2', color: '#991B1B' },
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #FFE4EF',
  overflow: 'hidden',
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: '#FF1493',
  color: '#fff',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShopSupplies() {
  const [tab, setTab] = useState<'suppliers' | 'requests'>('suppliers')
  const [quoteSupplier, setQuoteSupplier] = useState<Supplier | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch('/api/shop/supplies/order')
      if (!res.ok) return
      const data = await res.json()
      setOrders(data || [])
    } catch { /* ignore */ }
    setOrdersLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'requests') fetchOrders()
  }, [tab, fetchOrders])

  const handleQuoteSubmitted = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 5000)
    setQuoteSupplier(null)
    setTab('requests')
    fetchOrders()
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'requests', label: 'Order Requests' },
  ]

  return (
    <div>
      {successMsg && (
        <div style={{
          background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, color: '#166534', fontWeight: 600, fontSize: 14,
        }}>
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              background: tab === t.key ? '#FF1493' : '#fff',
              color: tab === t.key ? '#fff' : '#666',
              boxShadow: tab === t.key ? '0 2px 8px rgba(255,20,147,0.3)' : 'none',
              ...(tab !== t.key ? { border: '1px solid #FFE4EF' } : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ====== SUPPLIERS TAB ====== */}
      {tab === 'suppliers' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>Bakery Supplier Directory</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#888' }}>
              Trusted suppliers for donut shops. Click "Request Quote" to submit an inquiry.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {SUPPLIERS.map(supplier => (
              <SupplierCard
                key={supplier.name}
                supplier={supplier}
                onRequestQuote={() => setQuoteSupplier(supplier)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ====== ORDER REQUESTS TAB ====== */}
      {tab === 'requests' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>Order Requests</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#888' }}>
              Track your quote requests and orders from suppliers.
            </p>
          </div>

          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading requests...</div>
          ) : orders.length === 0 ? (
            <div style={{ ...card, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#444' }}>No requests yet</div>
              <div style={{ fontSize: 14, color: '#999', marginTop: 6 }}>
                Browse the directory and click "Request Quote" to submit your first inquiry.
              </div>
              <button onClick={() => setTab('suppliers')} style={{ ...btnPrimary, marginTop: 18 }}>
                Browse Suppliers
              </button>
            </div>
          ) : (
            orders.map(order => {
              const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending
              const expanded = expandedOrder === order.id
              return (
                <div key={order.id} style={{ ...card, marginBottom: 12 }}>
                  <div
                    onClick={() => setExpandedOrder(expanded ? null : order.id)}
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{order.order_number}</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: sc.bg, color: sc.color, textTransform: 'capitalize',
                      }}>
                        {order.status}
                      </span>
                      <span style={{ fontSize: 14, color: '#bbb' }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ borderTop: '1px solid #FFE4EF', padding: '16px 20px' }}>
                      {order.notes ? (
                        <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {order.notes}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: '#aaa' }}>No details provided.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ====== QUOTE MODAL ====== */}
      {quoteSupplier && (
        <QuoteModal
          supplier={quoteSupplier}
          onClose={() => setQuoteSupplier(null)}
          onSuccess={handleQuoteSubmitted}
        />
      )}
    </div>
  )
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({ supplier, onRequestQuote }: { supplier: Supplier; onRequestQuote: () => void }) {
  return (
    <div style={{
      ...card,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'box-shadow 0.15s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #FFF0F7, #FFE4EF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
          border: '1px solid #FFD6EC',
        }}>
          {supplier.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#1a1a1a', lineHeight: 1.2 }}>{supplier.name}</div>
          <a
            href={`https://${supplier.website}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 13, color: '#FF1493', textDecoration: 'none', fontWeight: 500 }}
          >
            {supplier.website} ↗
          </a>
        </div>
      </div>

      {/* Category tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {supplier.categories.map(cat => (
          <span
            key={cat}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: '#FFF0F7', color: '#C2185B', border: '1px solid #FFD6EC',
            }}
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.6 }}>
        {supplier.description}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
        <button
          onClick={onRequestQuote}
          style={{ ...{ padding: '9px 18px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }, flex: 1 }}
        >
          Request Quote
        </button>
        <a
          href={`https://${supplier.website}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '9px 18px', borderRadius: 8, background: '#fff', color: '#FF1493',
            fontWeight: 700, border: '1px solid #FFE4EF', cursor: 'pointer', fontSize: 14,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}
        >
          Visit Site
        </a>
      </div>
    </div>
  )
}

// ─── Quote Modal ──────────────────────────────────────────────────────────────

function QuoteModal({
  supplier,
  onClose,
  onSuccess,
}: {
  supplier: Supplier
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [items, setItems] = useState('')
  const [quantity, setQuantity] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!items.trim()) {
      setError('Please describe the items you need.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/shop/supplies/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: supplier.name,
          items_description: items.trim(),
          quantity_estimate: quantity.trim() || undefined,
          delivery_date: deliveryDate || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to submit request.')
        setSubmitting(false)
        return
      }
      const data = await res.json()
      onSuccess(`Quote request ${data.order_number} submitted to ${supplier.name}!`)
    } catch {
      setError('Failed to submit request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #FFE4EF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1a1a1a' }}>Request Quote</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{supplier.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#444', marginBottom: 6 }}>
              Items Needed <span style={{ color: '#FF1493' }}>*</span>
            </label>
            <textarea
              value={items}
              onChange={e => setItems(e.target.value)}
              placeholder="e.g. Glazed donut mix (25 lb bags), chocolate icing, powdered sugar..."
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#444', marginBottom: 6 }}>
              Estimated Quantity
            </label>
            <input
              type="text"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 10 cases, 200 lbs, monthly order"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#444', marginBottom: 6 }}>
              Preferred Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#444', marginBottom: 6 }}>
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Delivery instructions, budget, special requirements..."
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #FFE4EF', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 8, background: '#fff', color: '#666',
              fontWeight: 600, border: '1px solid #ddd', cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...{ padding: '10px 24px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }, opacity: submitting ? 0.65 : 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
