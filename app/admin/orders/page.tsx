'use client'

import { useEffect, useState } from 'react'
import { ORDER_STATUS_LABELS } from '@/lib/constants'

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
  shop: { name: string } | null
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

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(r => r.json())
      .then(data => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading orders...</div>

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: '#6B7280' }}>{orders.length} orders</div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Order ID', 'Customer', 'Shop', 'Total', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const colors = STATUS_COLORS[order.status] || { bg: '#F3F4F6', text: '#374151' }
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                      {order.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{order.customer?.name || '-'}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 12 }}>{order.customer?.email || ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{order.shop?.name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>${order.total.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: colors.bg, color: colors.text,
                      }}>
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
