'use client'

import { useState, useEffect, useCallback } from 'react'

type Category = { id: string; name: string; sort_order: number }
type Product = {
  id: string; name: string; description: string | null; unit: string; sku: string | null
  supplier_cost: number; shop_price: number; min_qty: number; image_url: string | null
  supplier_name: string; category_id: string; supplier_id: string
}
type CartItem = { product: Product; quantity: number }
type OrderItem = {
  id: string; product_name: string; supplier_name: string; quantity: number
  unit_price: number; supplier_cost: number; total: number
}
type Order = {
  id: string; order_number: string; status: string; subtotal: number
  margin_total: number; total: number; notes: string | null
  created_at: string; updated_at: string; items: OrderItem[]
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF9C3', color: '#854D0E' },
  confirmed: { bg: '#DBEAFE', color: '#1E40AF' },
  processing: { bg: '#FFEDD5', color: '#9A3412' },
  shipped: { bg: '#F3E8FF', color: '#6B21A8' },
  delivered: { bg: '#DCFCE7', color: '#166534' },
  cancelled: { bg: '#FEE2E2', color: '#991B1B' },
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, width: '100%' }

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function ShopSupplies() {
  const [tab, setTab] = useState<'catalog' | 'cart' | 'orders'>('catalog')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const url = selectedCategory !== 'all'
        ? `/api/shop/supplies?category=${selectedCategory}`
        : '/api/shop/supplies'
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json()
      setProducts(data.products || [])
      setCategories(data.categories || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [selectedCategory])

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

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { if (tab === 'orders') fetchOrders() }, [tab, fetchOrders])

  const addToCart = (product: Product, qty: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + qty } : c)
      }
      return [...prev, { product, quantity: Math.max(product.min_qty, qty) }]
    })
  }

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = c.quantity + delta
      return newQty < 1 ? c : { ...c, quantity: newQty }
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId))
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.product.shop_price * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  const placeOrder = async () => {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      const res = await fetch('/api/shop/supplies/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
          notes: orderNotes || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to place order')
        return
      }
      const data = await res.json()
      setCart([])
      setOrderNotes('')
      setSuccessMsg(`Order ${data.order_number} placed successfully!`)
      setTimeout(() => setSuccessMsg(''), 5000)
      setTab('orders')
      fetchOrders()
    } catch {
      alert('Failed to place order')
    }
    setPlacing(false)
  }

  const cancelOrder = async (orderId: string) => {
    setCancelling(orderId)
    try {
      const res = await fetch('/api/shop/supplies/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      if (res.ok) fetchOrders()
      else {
        const err = await res.json()
        alert(err.error || 'Failed to cancel')
      }
    } catch { alert('Failed to cancel order') }
    setCancelling(null)
  }

  const filteredProducts = products.filter(p => {
    if (search) {
      const s = search.toLowerCase()
      return p.name.toLowerCase().includes(s) || p.supplier_name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s)
    }
    return true
  })

  const tabs: { key: typeof tab; label: string; badge?: number }[] = [
    { key: 'catalog', label: 'Catalog' },
    { key: 'cart', label: 'Cart', badge: cartCount || undefined },
    { key: 'orders', label: 'Orders' },
  ]

  return (
    <div>
      {successMsg && (
        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#166534', fontWeight: 600, fontSize: 14 }}>
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, position: 'relative',
              background: tab === t.key ? '#FF1493' : '#fff',
              color: tab === t.key ? '#fff' : '#666',
              boxShadow: tab === t.key ? '0 2px 8px rgba(255,20,147,0.3)' : 'none',
              ...(tab !== t.key ? { border: '1px solid #FFE4EF' } : {}),
            }}
          >
            {t.label}
            {t.badge ? (
              <span style={{
                position: 'absolute', top: -6, right: -6, background: '#DC2626', color: '#fff',
                borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 800,
              }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ====== CATALOG TAB ====== */}
      {tab === 'catalog' && (
        <div>
          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, maxWidth: 400 }}
            />
          </div>

          {/* Category filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                background: selectedCategory === 'all' ? '#FF1493' : '#fff',
                color: selectedCategory === 'all' ? '#fff' : '#666',
                ...(selectedCategory !== 'all' ? { border: '1px solid #FFE4EF' } : {}),
              }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: 13,
                  background: selectedCategory === cat.id ? '#FF1493' : '#fff',
                  color: selectedCategory === cat.id ? '#fff' : '#666',
                  ...(selectedCategory !== cat.id ? { border: '1px solid #FFE4EF' } : {}),
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No products found</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== CART TAB ====== */}
      {tab === 'cart' && (
        <div>
          {cart.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>Your cart is empty</div>
              <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Browse the catalog to add supply items</div>
              <button onClick={() => setTab('catalog')} style={{ ...btnPrimary, marginTop: 16 }}>Browse Catalog</button>
            </div>
          ) : (
            <div style={{ maxWidth: 600 }}>
              {cart.map(item => (
                <div key={item.product.id} style={{ ...card, padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.product.name}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{item.product.supplier_name} &middot; {item.product.unit}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#FF1493', marginTop: 4 }}>{fmt(item.product.shop_price)} each</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => updateCartQty(item.product.id, -1)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                    >
                      −
                    </button>
                    <span style={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, 1)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 70 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(item.product.shop_price * item.quantity)}</div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div style={{ ...card, padding: 16, marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Order Notes (optional)</label>
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Delivery instructions, special requests..."
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                />
              </div>

              {/* Totals & Place Order */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: '#666' }}>Items</span>
                  <span style={{ fontWeight: 600 }}>{cartCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 18 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 800, color: '#FF1493' }}>{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={placing}
                  style={{
                    ...btnPrimary, width: '100%', padding: 14, fontSize: 16,
                    opacity: placing ? 0.6 : 1,
                  }}
                >
                  {placing ? 'Placing Order...' : 'Place Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== ORDERS TAB ====== */}
      {tab === 'orders' && (
        <div style={{ maxWidth: 700 }}>
          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>No orders yet</div>
              <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Place your first supply order from the catalog</div>
            </div>
          ) : (
            orders.map(order => {
              const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending
              const expanded = expandedOrder === order.id
              return (
                <div key={order.id} style={{ ...card, marginBottom: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedOrder(expanded ? null : order.id)}
                    style={{ padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{order.order_number}</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' '}&middot;{' '}{(order.items || []).length} items
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: sc.bg, color: sc.color, textTransform: 'capitalize',
                      }}>
                        {order.status}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(order.total)}</span>
                      <span style={{ fontSize: 14, color: '#aaa' }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: '1px solid #FFE4EF', padding: 16 }}>
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < (order.items || []).length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{item.quantity} &times; {item.product_name}</span>
                            <div style={{ fontSize: 12, color: '#999' }}>{item.supplier_name}</div>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(item.total)}</span>
                        </div>
                      ))}
                      {order.notes && (
                        <div style={{ fontSize: 13, color: '#666', marginTop: 10, padding: '8px 10px', background: '#FFF5F8', borderRadius: 6 }}>
                          Notes: {order.notes}
                        </div>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelOrder(order.id) }}
                          disabled={cancelling === order.id}
                          style={{
                            marginTop: 12, padding: '8px 16px', borderRadius: 8, background: '#FEE2E2',
                            color: '#DC2626', fontWeight: 700, border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 13,
                            opacity: cancelling === order.id ? 0.6 : 1,
                          }}
                        >
                          {cancelling === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product, qty: number) => void }) {
  const [qty, setQty] = useState(product.min_qty || 1)

  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{product.name}</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{product.supplier_name}</div>
        <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>{product.unit}</div>
        {product.description && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>{product.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#FF1493' }}>{fmt(product.shop_price)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setQty(q => Math.max(product.min_qty || 1, q - 1))}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
          >
            −
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{qty}</span>
          <button
            onClick={() => setQty(q => q + 1)}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
          >
            +
          </button>
          <button
            onClick={() => { onAdd(product, qty); setQty(product.min_qty || 1) }}
            style={{ padding: '6px 12px', borderRadius: 8, background: '#FF1493', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
