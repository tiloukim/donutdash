'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import type { MenuItem } from '@/lib/types'

interface GroupOrderItem {
  id: string
  group_order_id: string
  user_id: string
  user_name: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions: string | null
  created_at: string
}

interface UserGroup {
  user_name: string
  user_id: string
  items: GroupOrderItem[]
}

interface GroupOrderData {
  groupOrder: {
    id: string
    host_id: string
    shop_id: string
    share_code: string
    status: 'open' | 'locked' | 'ordered'
    created_at: string
    expires_at: string
  }
  shop: { id: string; name: string; slug: string; image_url: string | null; banner_url: string | null }
  host: { id: string; name: string }
  itemsByUser: UserGroup[]
  allItems: GroupOrderItem[]
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'donuts', label: 'Donuts' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'other', label: 'Other' },
]

export default function GroupOrderPage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()
  const router = useRouter()
  const { user } = useAuth()
  const { addItem: addToLocalCart, clearCart } = useCart()

  const [data, setData] = useState<GroupOrderData | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [removingItem, setRemovingItem] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchGroupOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/group-order?code=${code}`)
      if (!res.ok) {
        setError('Group order not found')
        return
      }
      const d = await res.json()
      setData(d)

      // Fetch menu
      if (d.shop?.id) {
        setMenuLoading(true)
        const menuRes = await fetch(`/api/shops/${d.shop.id}/menu`)
        const menuData = await menuRes.json()
        setMenuItems(menuData.items || [])
        setMenuLoading(false)
      }
    } catch {
      setError('Failed to load group order')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    fetchGroupOrder()
  }, [fetchGroupOrder])

  // Poll for updates every 10s
  useEffect(() => {
    if (!data || data.groupOrder.status === 'ordered') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/group-order?code=${code}`)
        if (res.ok) {
          const d = await res.json()
          setData(d)
        }
      } catch { /* ignore */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [data, code])

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!user || !data || data.groupOrder.status !== 'open') return
    setAddingItem(menuItem.id)
    try {
      const res = await fetch('/api/group-order/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_order_id: data.groupOrder.id,
          menu_item_id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        }),
      })
      if (res.ok) {
        await fetchGroupOrder()
      }
    } catch { /* ignore */ }
    setTimeout(() => setAddingItem(null), 800)
  }

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItem(itemId)
    try {
      const res = await fetch('/api/group-order/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      if (res.ok) {
        await fetchGroupOrder()
      }
    } catch { /* ignore */ }
    setRemovingItem(null)
  }

  const handleLockAndCheckout = async () => {
    if (!data) return
    setLocking(true)
    try {
      const res = await fetch('/api/group-order/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_order_id: data.groupOrder.id }),
      })
      if (res.ok) {
        // Add all items to local cart for checkout
        clearCart()
        for (const item of data.allItems) {
          addToLocalCart(
            {
              id: `group-${item.id}`,
              name: `${item.name} (${item.user_name})`,
              price: Number(item.price),
              quantity: item.quantity,
              image_url: null,
              special_instructions: item.special_instructions,
            },
            data.groupOrder.shop_id,
            data.shop.name,
          )
        }
        router.push('/cart')
      }
    } catch { /* ignore */ }
    setLocking(false)
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/group-order/${code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isHost = user && data ? user.id === data.groupOrder.host_id : false
  const isOpen = data?.groupOrder.status === 'open'
  const isLocked = data?.groupOrder.status === 'locked'

  const filteredMenu = selectedCategory === 'all'
    ? menuItems.filter(i => i.is_available && !i.is_sold_out)
    : menuItems.filter(i => i.is_available && !i.is_sold_out && i.category === selectedCategory)

  const grandTotal = data?.allItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0) || 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ height: '24px', width: '250px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '1rem' }} />
          <div style={{ height: '16px', width: '400px', background: '#f5f5f5', borderRadius: '6px' }} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔗</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Group order not found</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>This link may have expired or the code is invalid.</p>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FFB6C1 100%)',
        padding: '2rem 1.5rem',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{
              background: isOpen ? '#10B981' : isLocked ? '#F59E0B' : '#6B7280',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}>
              {data.groupOrder.status}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
              Group Order
            </span>
          </div>
          <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {data.shop.name}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Hosted by {data.host.name} &middot; Code: <strong>{code}</strong>
          </p>
          <button
            onClick={handleCopyLink}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </button>
        </div>
      </div>

      {!user && (
        <div style={{
          background: '#FEF3C7', borderBottom: '1px solid #FCD34D',
          padding: '12px 1.5rem', textAlign: 'center',
        }}>
          <span style={{ color: '#92400E', fontSize: '0.9rem' }}>
            <Link href={`/login?redirect=/group-order/${code}`} style={{ color: '#92400E', fontWeight: 700 }}>Sign in</Link> to add items to this group order.
          </span>
        </div>
      )}

      <main style={{ flex: 1, padding: '1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>

            {/* Items by Person */}
            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#1A1A2E' }}>
                Order Summary
              </h2>

              {data.itemsByUser.length === 0 ? (
                <div style={{
                  background: '#f9f9f9', borderRadius: '12px', padding: '2rem',
                  textAlign: 'center', color: '#888',
                }}>
                  No items yet. Be the first to add something!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {data.itemsByUser.map(group => {
                    const userTotal = group.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
                    return (
                      <div key={group.user_id} style={{
                        background: 'white', border: '1px solid #f0f0f0',
                        borderRadius: '12px', padding: '1rem 1.25rem',
                      }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: '0.75rem',
                        }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1A2E' }}>
                            {group.user_name}
                            {user && group.user_id === user.id && (
                              <span style={{ color: '#FF1493', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(You)</span>
                            )}
                          </span>
                          <span style={{ fontWeight: 700, color: '#FF1493', fontSize: '0.9rem' }}>
                            ${userTotal.toFixed(2)}
                          </span>
                        </div>
                        {group.items.map(item => (
                          <div key={item.id} style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', padding: '0.4rem 0',
                            borderTop: '1px solid #f5f5f5',
                          }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '0.85rem', color: '#333' }}>
                                {item.quantity}x {item.name}
                              </span>
                              {item.special_instructions && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                  {item.special_instructions}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                ${(Number(item.price) * item.quantity).toFixed(2)}
                              </span>
                              {isOpen && user && (user.id === item.user_id || isHost) && (
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={removingItem === item.id}
                                  style={{
                                    background: 'none', border: 'none', color: '#DC2626',
                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                    opacity: removingItem === item.id ? 0.5 : 1,
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}

                  {/* Grand Total */}
                  <div style={{
                    background: '#FFF0F5', borderRadius: '12px', padding: '1rem 1.25rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A1A2E' }}>
                      Grand Total ({data.allItems.reduce((s, i) => s + i.quantity, 0)} items)
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#FF1493' }}>
                      ${grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Host Lock & Checkout */}
              {isHost && isOpen && data.allItems.length > 0 && (
                <button
                  onClick={handleLockAndCheckout}
                  disabled={locking}
                  style={{
                    width: '100%', marginTop: '1rem',
                    padding: '0.85rem', background: locking ? '#ccc' : '#FF1493',
                    color: 'white', border: 'none', borderRadius: '10px',
                    fontSize: '1rem', fontWeight: 700,
                    cursor: locking ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {locking ? 'Locking...' : 'Lock & Checkout'}
                </button>
              )}

              {isLocked && (
                <div style={{
                  marginTop: '1rem', background: '#FEF3C7',
                  borderRadius: '10px', padding: '1rem', textAlign: 'center',
                }}>
                  <p style={{ color: '#92400E', fontWeight: 600, fontSize: '0.9rem' }}>
                    This group order has been locked. {isHost ? 'Proceed to checkout.' : 'The host is completing the order.'}
                  </p>
                  {isHost && (
                    <Link href="/cart" style={{
                      display: 'inline-block', marginTop: '0.75rem',
                      background: '#FF1493', color: 'white', padding: '0.6rem 1.5rem',
                      borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem',
                    }}>
                      Go to Cart
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* Menu Section */}
            {isOpen && user && (
              <section>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#1A1A2E' }}>
                  Add Items
                </h2>

                {/* Category Tabs */}
                <div style={{
                  display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
                  overflowX: 'auto', paddingBottom: '0.5rem',
                }}>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      style={{
                        padding: '0.4rem 1rem', borderRadius: '20px',
                        border: 'none',
                        background: selectedCategory === cat.key ? '#FF1493' : '#f5f5f5',
                        color: selectedCategory === cat.key ? 'white' : '#666',
                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {menuLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ background: '#f5f5f5', borderRadius: '12px', height: '80px' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                  }}>
                    {filteredMenu.map(item => (
                      <div key={item.id} style={{
                        background: 'white', border: '1px solid #f0f0f0',
                        borderRadius: '10px', padding: '0.75rem',
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: '0.5rem',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600, fontSize: '0.85rem', color: '#1A1A2E',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.name}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#666' }}>
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddItem(item)}
                          disabled={addingItem === item.id}
                          style={{
                            background: addingItem === item.id ? '#10B981' : '#FF8C00',
                            color: 'white', border: 'none', borderRadius: '6px',
                            padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                            fontWeight: 600, cursor: 'pointer',
                            whiteSpace: 'nowrap', transition: 'background 0.2s',
                          }}
                        >
                          {addingItem === item.id ? 'Added!' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
