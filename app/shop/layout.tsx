'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'
import PendingReferralApplier from '@/components/PendingReferralApplier'
import { ShopLangProvider, useShopLang } from '@/lib/shop-lang-context'
import type { TranslationKey } from '@/lib/shop-i18n'
import { useRealtime } from '@/lib/use-realtime'
import { playUrgentAlert, stopUrgentAlert, unlockAudio } from '@/lib/alert-sound'

const NAV_ITEMS: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/shop', labelKey: 'nav.dashboard', icon: '📊' },
  { href: '/shop/orders', labelKey: 'nav.orders', icon: '📋' },
  { href: '/shop/earnings', labelKey: 'nav.earnings', icon: '💰' },
  { href: '/shop/menu', labelKey: 'nav.menu', icon: '🍩' },
  { href: '/shop/analytics', labelKey: 'nav.analytics', icon: '📈' },
  { href: '/shop/hours', labelKey: 'nav.hours', icon: '🕐' },
  { href: '/shop/referral', labelKey: 'nav.referral', icon: '🎁' },
  { href: '/shop/support', labelKey: 'nav.support', icon: '💬' },
  { href: '/shop/disputes', labelKey: 'nav.issues', icon: '⚠️' },
  { href: '/shop/documents', labelKey: 'nav.documents', icon: '📄' },
  { href: '/shop/settings', labelKey: 'nav.settings', icon: '⚙️' },
]

const FINANCE_NAV: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/shop/bookkeeping', labelKey: 'nav.bookkeeping', icon: '📒' },
  { href: '/shop/tax-forms', labelKey: 'nav.taxForms', icon: '📋' },
]

const SUPPLY_NAV: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/shop/supplies', labelKey: 'nav.supplies', icon: '📦' },
]

const COMMUNITY_NAV: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/shop/community', labelKey: 'nav.community', icon: '👥' },
]

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopLangProvider>
      <ShopLayoutInner>{children}</ShopLayoutInner>
    </ShopLangProvider>
  )
}

function ShopLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const { lang, setLang, t } = useShopLang()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shopName, setShopName] = useState<string>('')
  const [hasShop, setHasShop] = useState(true)

  useEffect(() => {
    if (!user || (role !== 'shop_owner' && role !== 'admin')) return
    fetch('/api/shop/settings')
      .then(r => {
        if (r.status === 404 || !r.ok) {
          // No shop found — redirect to partner setup
          setHasShop(false)
          router.push('/partner-setup')
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data?.name) { setShopName(data.name); setHasShop(true) }
      })
      .catch(() => {})
  }, [user, role, router])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>

  if (!user || (role !== 'shop_owner' && role !== 'admin')) {
    return (
      <RoleAuthForm
        role="shop_owner"
        roleLabel="Shop Owner"
        accentColor="#FF1493"
        accentHover="#FF69B4"
        bgGradient="linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)"
        icon="🍩"
        tagline="Manage your donut shop"
        redirectTo="/shop"
      />
    )
  }

  const sidebar = (
    <>
      <div style={{ padding: '16px 14px 10px' }}>
        <img src="/logo.png" alt="DonutDash" style={{ height: 32, width: 'auto', filter: 'brightness(10)' }} />
        <div style={{ marginTop: 4 }}>
          <span style={{ background: '#fff', color: '#FF1493', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
            {shopName || 'SHOP'}
          </span>
        </div>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, padding: '0 6px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
            color: pathname === item.href ? '#FF1493' : '#fff',
            background: pathname === item.href ? '#fff' : 'transparent',
          }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span> {t(item.labelKey)}
          </Link>
        ))}
        {/* Finance section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', margin: '6px 0 2px', paddingTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', padding: '0 10px 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Finance</div>
          {FINANCE_NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: pathname === item.href ? '#FF1493' : '#fff',
              background: pathname === item.href ? '#fff' : 'transparent',
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span> {t(item.labelKey)}
            </Link>
          ))}
        </div>
        {/* Supplies section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', margin: '6px 0 2px', paddingTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', padding: '0 10px 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Ordering</div>
          {SUPPLY_NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: pathname === item.href ? '#FF1493' : '#fff',
              background: pathname === item.href ? '#fff' : 'transparent',
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span> {t(item.labelKey)}
            </Link>
          ))}
        </div>
        {/* Community section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', margin: '6px 0 2px', paddingTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', padding: '0 10px 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Community</div>
          {COMMUNITY_NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: pathname === item.href ? '#FF1493' : '#fff',
              background: pathname === item.href ? '#fff' : 'transparent',
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span> {t(item.labelKey)}
            </Link>
          ))}
        </div>
      </nav>
      <div style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <button
          onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '6px 10px', color: '#fff', background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            marginBottom: 4,
          }}
        >
          🌐 {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
        </button>
        <Link href="/support/shops" style={{ display: 'block', padding: '4px 10px', color: 'rgba(255,255,255,0.7)', fontSize: 11, textDecoration: 'none' }}>
          📧 Shop Support
        </Link>
        <div style={{ padding: '4px 10px', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{user.name}</div>
        <button onClick={() => signOut('/shop')} style={{ display: 'block', width: '100%', padding: '4px 10px', color: '#FFB6C1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>{t('nav.signOut')}</button>
      </div>
    </>
  )

  return (
    <>
    <head><link rel="manifest" href="/manifest-shop.json" /></head>
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 220, background: '#FF1493', color: '#fff', display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      }} className="shop-sidebar-desktop">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        style={{
          width: 260, background: '#FF1493', color: '#fff', display: 'none', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
        className="shop-sidebar-mobile"
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, background: '#FFF5F8', minHeight: '100vh', minWidth: 0 }} className="shop-main">
        <header style={{ background: '#fff', borderBottom: '1px solid #FFE4EF', padding: '16px 24px', paddingTop: 'max(16px, env(safe-area-inset-top))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }} className="shop-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4, flexShrink: 0 }}
              className="shop-hamburger"
            >
              ☰
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="shop-header-title">
              {(() => { const nav = [...NAV_ITEMS, ...FINANCE_NAV, ...SUPPLY_NAV, ...COMMUNITY_NAV].find(n => n.href === pathname); return nav ? t(nav.labelKey) : t('nav.dashboard') })()}
            </h1>
          </div>
          <span style={{ fontSize: 14, color: '#666', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} className="shop-header-name">{user.name}</span>
        </header>
        <div style={{ padding: '16px 12px' }} className="shop-content">{children}</div>
      </main>

      <style>{`
        .shop-content { max-width: 100%; overflow-wrap: anywhere; }
        .shop-content [style*="display: flex"], .shop-content [style*="display:flex"] { min-width: 0; }
        .shop-content [style*="display: flex"] > *, .shop-content [style*="display:flex"] > * { min-width: 0; }
        .shop-content img, .shop-content video { max-width: 100%; height: auto; }
        @media (min-width: 769px) {
          .shop-content { padding: 24px !important; }
        }
        @media (max-width: 768px) {
          .shop-sidebar-desktop { display: none !important; }
          .shop-sidebar-mobile { display: flex !important; }
          .shop-main { margin-left: 0 !important; }
          .shop-hamburger { display: block !important; }
        }
        @media (max-width: 390px) {
          .shop-header { padding: 12px !important; }
          .shop-header-title { font-size: 17px !important; }
          .shop-header-name { display: none !important; }
          .shop-content { padding: 12px 10px !important; }
        }
      `}</style>
    </div>
    <GlobalOrderAlert />
    <PendingReferralApplier kind="shop" />
    </>
  )
}

// Global new-order popup — works on ANY shop page
function GlobalOrderAlert() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('Out of stock')
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustedItems, setAdjustedItems] = useState<Record<string, Record<number, number>>>({})
  const [shopId, setShopId] = useState<string | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

  // Try to unlock audio on mount + on any user interaction
  useEffect(() => {
    unlockAudio('/order-alert.wav')
  }, [])

  // Fetch shop id for realtime filter
  useEffect(() => {
    fetch('/api/shop/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setShopId(data.id) })
      .catch(() => {})
  }, [])

  const playSound = useCallback(() => {
    playUrgentAlert('/order-alert.wav')
  }, [])

  const stopSound = useCallback(() => {
    stopUrgentAlert()
  }, [])

  // Fetch pending orders, alert on any unseen ones (including on first load)
  const refreshPending = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/shop/orders?status=pending')
      if (!res.ok) return
      const data = await res.json()
      const pending = data.filter((o: any) => o.status === 'pending')

      if (!silent) {
        const newOrders = pending.filter((o: any) => !knownIdsRef.current.has(o.id))
        if (newOrders.length > 0) {
          playSound()
          if ('Notification' in window && Notification.permission === 'granted') {
            newOrders.forEach((o: any) => {
              new Notification('New Order!', {
                body: `Order #${o.id.slice(0, 8)} — $${o.subtotal?.toFixed(2)}`,
                icon: '/logo.png', tag: `order-${o.id}`, requireInteraction: true,
              })
            })
          }
        }
      }
      knownIdsRef.current = new Set(pending.map((o: any) => o.id))
      setPendingOrders(pending)
      if (pending.length === 0) stopSound()
    } catch {}
  }, [playSound, stopSound])

  // Realtime subscription — instant detection, works in background tabs
  useRealtime({
    table: 'dd_orders',
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    event: 'INSERT',
    enabled: !!shopId,
    onData: () => { refreshPending() },
  })

  // Polling fallback (every 30s) — covers realtime outages and Chrome tab freezing
  useEffect(() => {
    refreshPending()
    const i = setInterval(() => refreshPending(), 30000)
    return () => { clearInterval(i); stopSound() }
  }, [refreshPending, stopSound])

  // Catch-up alert: when tab regains focus, replay sound if orders are pending
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && knownIdsRef.current.size > 0) {
        refreshPending(true).then(() => {
          if (knownIdsRef.current.size > 0) playSound()
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshPending, playSound])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  const getAdjustedQty = (orderId: string, idx: number, originalQty: number) => {
    return adjustedItems[orderId]?.[idx] ?? originalQty
  }

  const setItemQty = (orderId: string, idx: number, qty: number) => {
    setAdjustedItems(prev => ({ ...prev, [orderId]: { ...prev[orderId], [idx]: Math.max(0, qty) } }))
  }

  const updateOrder = async (orderId: string, status: string, reason?: string) => {
    setUpdating(orderId)

    // If accepting with adjustments, update items first
    if (status === 'confirmed' && adjustedItems[orderId]) {
      const order = pendingOrders.find(o => o.id === orderId)
      if (order) {
        const adj = adjustedItems[orderId]
        const hasChanges = Object.keys(adj).some(k => adj[parseInt(k)] !== (order.items || [])[parseInt(k)]?.quantity)
        if (hasChanges) {
          await fetch('/api/shop/orders/adjust', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderId,
              items: (order.items || []).map((item: any, i: number) => ({
                id: item.id, quantity: getAdjustedQty(orderId, i, item.quantity),
              })).filter((item: any) => item.quantity > 0),
            }),
          })
        }
      }
    }

    await fetch('/api/shop/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status, ...(reason ? { cancellation_reason: reason } : {}) }),
    })
    setPendingOrders(prev => prev.filter(o => o.id !== orderId))
    setRejectingId(null)
    setAdjustingId(null)
    setAdjustedItems(prev => { const n = { ...prev }; delete n[orderId]; return n })
    setUpdating(null)
    if (pendingOrders.length <= 1) stopSound()
    if (pathname === '/shop/orders') router.refresh()
  }

  // Skip rendering popup on the orders page itself (it has its own UI)
  if (pathname === '/shop/orders') return null
  if (pendingOrders.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%',
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          background: '#FF1493', padding: '20px 24px', borderRadius: '20px 20px 0 0',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 4 }}>🔔</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
            {pendingOrders.length === 1 ? 'New Order!' : `${pendingOrders.length} New Orders!`}
          </div>
        </div>

        {/* Orders */}
        <div style={{ padding: '16px 20px' }}>
          {pendingOrders.map(o => (
            <div key={o.id} style={{
              border: '2px solid #FF1493', borderRadius: 12, padding: 16, marginBottom: 12,
              background: '#FFF0F5',
            }}>
              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 800, color: '#FF1493', fontSize: 16 }}>#{o.id.slice(0, 8)}</span>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{o.customer?.name || 'Customer'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>${o.subtotal?.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{(o.items || []).reduce((s: number, i: any) => s + i.quantity, 0)} items</div>
                </div>
              </div>
              {/* Item list */}
              <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                {(o.items || []).map((item: any, idx: number) => {
                  const qty = getAdjustedQty(o.id, idx, item.quantity)
                  const removed = qty === 0
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < (o.items || []).length - 1 ? '1px solid #f5f5f5' : 'none', opacity: removed ? 0.4 : 1 }}>
                      {adjustingId === o.id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => setItemQty(o.id, idx, qty - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd', background: qty === 0 ? '#eee' : '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{qty}</span>
                          <button onClick={() => setItemQty(o.id, idx, qty + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd', background: '#ECFDF5', color: '#065F46', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, textDecoration: removed ? 'line-through' : 'none' }}>{adjustingId !== o.id ? `${qty} × ` : ''}{item.name}</span>
                        {item.special_instructions && <div style={{ fontSize: 11, color: '#FF8C00', marginTop: 2 }}>⚠️ {item.special_instructions}</div>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: removed ? '#ccc' : '#333', flexShrink: 0 }}>${(item.price * qty).toFixed(2)}</span>
                    </div>
                  )
                })}
                {/* Adjusted total */}
                {adjustingId === o.id && adjustedItems[o.id] && (
                  <div style={{ borderTop: '2px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                    <span>Adjusted Total</span>
                    <span>${(o.items || []).reduce((s: number, item: any, i: number) => s + item.price * getAdjustedQty(o.id, i, item.quantity), 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
              {/* Adjust button */}
              {adjustingId !== o.id && rejectingId !== o.id && (
                <button onClick={() => setAdjustingId(o.id)} style={{ fontSize: 12, color: '#FF8C00', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0', marginBottom: 8 }}>
                  ✏️ Adjust items (out of stock?)
                </button>
              )}
              {adjustingId === o.id && (
                <button onClick={() => { setAdjustingId(null); setAdjustedItems(prev => { const n = { ...prev }; delete n[o.id]; return n }) }} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0', marginBottom: 8 }}>
                  ↩ Reset items
                </button>
              )}
              {/* Delivery address */}
              {o.delivery_address && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 12, display: 'flex', gap: 4 }}>
                  <span>📍</span><span>{o.delivery_address}</span>
                </div>
              )}
              {o.delivery_instructions && (
                <div style={{ fontSize: 12, color: '#FF8C00', marginBottom: 12 }}>📝 {o.delivery_instructions}</div>
              )}

              {rejectingId === o.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{
                    padding: 10, borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 14,
                  }}>
                    <option value="Out of stock">Out of stock</option>
                    <option value="Too busy">Too busy</option>
                    <option value="Shop closing soon">Shop closing soon</option>
                    <option value="Other">Other</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateOrder(o.id, 'cancelled', rejectReason)} disabled={updating === o.id} style={{
                      flex: 1, padding: 12, borderRadius: 10, background: '#DC2626', color: '#fff',
                      fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14,
                    }}>
                      {updating === o.id ? '...' : 'Confirm Reject'}
                    </button>
                    <button onClick={() => setRejectingId(null)} style={{
                      padding: '12px 16px', borderRadius: 10, background: '#f5f5f5', color: '#555',
                      fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 14,
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateOrder(o.id, 'confirmed')} disabled={updating === o.id} style={{
                    flex: 1, padding: 14, borderRadius: 10, background: '#10B981', color: '#fff',
                    fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 16,
                  }}>
                    {updating === o.id ? '...' : '✓ Accept'}
                  </button>
                  <button onClick={() => { setRejectingId(o.id); setRejectReason('Out of stock') }} style={{
                    padding: '14px 20px', borderRadius: 10, background: '#FEE2E2', color: '#DC2626',
                    fontWeight: 700, border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 14,
                  }}>
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
