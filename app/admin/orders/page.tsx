'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ORDER_STATUS_LABELS, SHOP_COMMISSION_RATE } from '@/lib/constants'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

interface OrderItem {
  name: string
  price: number
  quantity: number
}

interface DeliveryInfo {
  driver_earnings: number
  driver_id: string | null
  status: string
  driver: { name: string } | null
}

interface OrderRow {
  id: string
  status: string
  subtotal: number
  delivery_fee: number
  service_fee: number
  tip: number
  total: number
  delivery_address: string
  created_at: string
  customer: { name: string; email: string } | null
  shop: { name: string; lat: number | null; lng: number | null } | null
  items: OrderItem[]
  delivery: DeliveryInfo[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
  preparing: { bg: '#E0E7FF', text: '#3730A3' },
  ready_for_pickup: { bg: '#D1FAE5', text: '#065F46' },
  picked_up: { bg: '#CFFAFE', text: '#155E75' },
  delivering: { bg: '#EDE9FE', text: '#5B21B6' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
}

const ACTIVE_DELIVERY_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering']

interface TrackingData {
  delivery_status: string
  driver: { name: string; avatar_url?: string } | null
  location: { lat: number; lng: number; updated_at?: string } | null
}

function DriverTracker({ orderId, shop }: { orderId: string; shop: { lat: number | null; lng: number | null } | null }) {
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [error, setError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTracking = useCallback(() => {
    fetch(`/api/driver/track/${orderId}`)
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => { setTracking(data); setError(false) })
      .catch(() => setError(true))
  }, [orderId])

  useEffect(() => {
    fetchTracking()
    intervalRef.current = setInterval(fetchTracking, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchTracking])

  if (error || !tracking) return null
  if (!shop?.lat || !shop?.lng) return null

  const statusLabel = ORDER_STATUS_LABELS[tracking.delivery_status] || tracking.delivery_status || '-'
  const lastUpdated = tracking.location?.updated_at
    ? new Date(tracking.location.updated_at).toLocaleString('en-US', {
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
      })
    : null

  return (
    <div style={{ flex: '1 1 100%', marginTop: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase',
        letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#22C55E',
          display: 'inline-block', animation: 'pulse 2s infinite',
        }} />
        Live Driver Tracking
      </div>
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
      }}>
        <div style={{
          flex: '1 1 400px', height: 300, borderRadius: 10,
          overflow: 'hidden', border: '2px solid #6366F1',
        }}>
          <DeliveryMap
            shopLat={shop.lat}
            shopLng={shop.lng}
            driverLat={tracking.location?.lat}
            driverLng={tracking.location?.lng}
          />
        </div>
        <div style={{
          flex: '0 1 220px', background: '#fff', borderRadius: 10,
          border: '1px solid #E5E7EB', padding: 16,
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 2 }}>DRIVER</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {tracking.driver?.name || 'Unknown'}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 2 }}>DELIVERY STATUS</div>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#6366F1',
            }}>
              {statusLabel}
            </span>
          </div>
          {lastUpdated && (
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 2 }}>LAST UPDATED</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{lastUpdated}</div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #E5E7EB',
      padding: '20px 24px',
      flex: '1 1 180px',
      minWidth: 180,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(r => r.json())
      .then(data => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading orders...</div>

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const serviceFees = orders.reduce((s, o) => s + (o.service_fee || 0), 0)
  const shopCommissions = orders.reduce((s, o) => s + ((o.subtotal || 0) * SHOP_COMMISSION_RATE), 0)
  const driverPayouts = orders.reduce((s, o) => {
    const d = o.delivery?.[0]
    return s + (d?.driver_earnings || 0)
  }, 0)
  const deliveryFees = orders.reduce((s, o) => s + (o.delivery_fee || 0), 0)
  const tipsCollected = orders.reduce((s, o) => s + (o.tip || 0), 0)
  const totalAdminProfit = serviceFees + shopCommissions + deliveryFees - driverPayouts

  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} sub={`${orders.length} orders`} />
        <SummaryCard label="Net Admin Profit" value={fmt(totalAdminProfit)} sub="After driver payouts" />
        <SummaryCard label="Shop Commissions" value={fmt(shopCommissions)} sub={`${(SHOP_COMMISSION_RATE * 100).toFixed(0)}% of subtotals`} />
        <SummaryCard label="Service Fees" value={fmt(serviceFees)} sub="From customers" />
        <SummaryCard label="Delivery Fees" value={fmt(deliveryFees)} sub="From customers" />
        <SummaryCard label="Driver Payouts" value={fmt(driverPayouts)} sub="Paid to drivers" />
        <SummaryCard label="Tips" value={fmt(tipsCollected)} sub="100% to drivers" />
      </div>

      {/* Orders Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['', 'Order ID', 'Customer', 'Shop', 'Subtotal', 'Shop Commission', 'Shop Receives', 'Delivery Fee', 'Service Fee', 'Tip', 'Total', 'Driver Pay', 'Admin Profit', 'Status', 'Date'].map(h => (
                  <th key={h || 'expand'} style={{
                    padding: '12px 12px',
                    textAlign: h === '' ? 'center' : 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const colors = STATUS_COLORS[order.status] || { bg: '#F3F4F6', text: '#374151' }
                const delivery = order.delivery?.[0] || null
                const isExpanded = expandedId === order.id
                return (
                  <Fragment key={order.id}>
                    <tr
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 14, color: '#6366F1' }}>
                        {isExpanded ? '\u25BC' : '\u25B6'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                        {order.id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <div style={{ fontWeight: 500 }}>{order.customer?.name || '-'}</div>
                        <div style={{ color: '#9CA3AF', fontSize: 11 }}>{order.customer?.email || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#6B7280' }}>{order.shop?.name || '-'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>${(order.subtotal || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#6366F1', fontWeight: 600 }}>
                        ${((order.subtotal || 0) * SHOP_COMMISSION_RATE).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#059669' }}>
                        ${((order.subtotal || 0) * (1 - SHOP_COMMISSION_RATE)).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>${(order.delivery_fee || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#6366F1', fontWeight: 600 }}>
                        ${(order.service_fee || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>${(order.tip || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 700 }}>${(order.total || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                        ${(delivery?.driver_earnings || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#059669', fontWeight: 700 }}>
                        ${(((order.subtotal || 0) * SHOP_COMMISSION_RATE) + (order.service_fee || 0) + (order.delivery_fee || 0) - (delivery?.driver_earnings || 0)).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: colors.bg, color: colors.text, whiteSpace: 'nowrap',
                        }}>
                          {ORDER_STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr style={{ background: '#F9FAFB' }}>
                        <td colSpan={15} style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                            {/* Items */}
                            <div style={{ flex: '1 1 300px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                Items Ordered
                              </div>
                              {order.items && order.items.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>Item</th>
                                      <th style={{ textAlign: 'center', padding: '4px 8px', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>Qty</th>
                                      <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>Price</th>
                                      <th style={{ textAlign: 'right', padding: '4px 8px', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '4px 8px' }}>{item.name}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>${(item.price || 0).toFixed(2)}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>
                                          ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ color: '#9CA3AF', fontSize: 13 }}>No items data</div>
                              )}
                            </div>

                            {/* Delivery & Address */}
                            <div style={{ flex: '0 1 280px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                Delivery Info
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                                <div>
                                  <span style={{ color: '#6B7280' }}>Address: </span>
                                  <span style={{ fontWeight: 500 }}>{order.delivery_address || '-'}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#6B7280' }}>Driver: </span>
                                  <span style={{ fontWeight: 500 }}>{delivery?.driver?.name || 'Not assigned'}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#6B7280' }}>Delivery Status: </span>
                                  <span style={{ fontWeight: 500 }}>{delivery?.status || '-'}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#6B7280' }}>Driver Earnings: </span>
                                  <span style={{ fontWeight: 600, color: '#059669' }}>${(delivery?.driver_earnings || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Live Driver Tracking */}
                            {ACTIVE_DELIVERY_STATUSES.includes(order.status) && (
                              <DriverTracker orderId={order.id} shop={order.shop} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {orders.length === 0 && (
                <tr><td colSpan={12} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
