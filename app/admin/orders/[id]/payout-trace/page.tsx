'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'

interface Trace {
  order: {
    id: string
    short_code: string | null
    status: string
    order_type: string | null
    created_at: string
    payment_method: string | null
    payment_id: string | null
    customer: { id: string; name: string; email: string } | null
    shop: { id: string; name: string; stripe_account_id: string | null } | null
    delivery: { driver_id?: string; driver_earnings?: number; status?: string; delivered_at?: string; driver?: { id: string; name: string } } | null
  }
  customer: {
    paid: number
    composition: {
      subtotal: number
      tax: number
      delivery_fee: number
      service_fee: number
      tip: number
      promo_discount: number
    }
  }
  splits: {
    shop_gross: number
    commission: number
    commission_rate_pct: number
    effective_shop: number
    effective_commission: number
    effective_delivery_fee: number
    effective_service_fee: number
    effective_tip: number
    effective_tax: number
    refund_amount: number
    refund_ratio_pct: number
    driver_earnings: number
    driver_base_pay: number
    driver_distance_miles: number
    driver_tip_passthrough: number
    application_fee: number
    platform_gross: number
    platform_net_keep: number
  }
  payouts: {
    items: Array<{
      id: string
      kind: string
      amount: number
      status: string
      paid_at: string | null
      week_start: string | null
      week_end: string | null
      batch_status: string | null
    }>
  }
}

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function PayoutTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/orders/${id}/payout-trace`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setTrace(data)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 40, color: '#6B7280' }}>Loading trace…</div>
  if (error) return (
    <div style={{ padding: 32, color: '#991B1B', background: '#FEE2E2', borderRadius: 12, border: '1px solid #FCA5A5' }}>
      {error}
    </div>
  )
  if (!trace) return <div style={{ padding: 40 }}>No data.</div>

  const s = trace.splits
  const c = trace.customer.composition
  const isWalkin = trace.order.order_type === 'pos_walkin'
  const driverName = trace.order.delivery?.driver?.name ?? '—'
  const customerName = trace.order.customer?.name ?? 'Walk-in'
  const shopName = trace.order.shop?.name ?? '—'

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#6B7280' }}>
        <Link href={`/admin/orders`} style={{ color: '#6366F1' }}>← Orders</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
            Payout Trace
          </h1>
          <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'monospace' }}>
            Order {trace.order.short_code ?? trace.order.id.slice(0, 8)} · {new Date(trace.order.created_at).toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {shopName} · {customerName} · {trace.order.payment_method ?? 'no payment'} · {trace.order.order_type}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Customer paid</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{fmt(trace.customer.paid)}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>status: {trace.order.status}</div>
        </div>
      </div>

      {/* Customer composition */}
      <Card title="Customer composition">
        <Row label="Subtotal (food)" value={fmt(c.subtotal)} />
        <Row label="Tax" value={fmt(c.tax)} subtle />
        <Row label="Delivery fee" value={fmt(c.delivery_fee)} subtle />
        <Row label="Service fee" value={fmt(c.service_fee)} subtle />
        {c.tip > 0 && <Row label="Tip" value={fmt(c.tip)} subtle />}
        {c.promo_discount > 0 && <Row label="Promo discount" value={`−${fmt(c.promo_discount)}`} color="#DC2626" />}
        <Row label="Total" value={fmt(trace.customer.paid)} bold />
      </Card>

      {/* Money waterfall */}
      <Card title="Money waterfall">
        {isWalkin ? (
          <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 8, color: '#6B7280', fontSize: 14 }}>
            Walk-in POS sale — shop collected payment directly at the register. Platform is not in the money flow.
          </div>
        ) : (
          <>
            <WaterfallRow
              label="Customer paid"
              value={fmt(trace.customer.paid)}
              icon="💳"
              color="#6366F1"
              big
            />
            <WaterfallRow
              label="Shop nets (subtotal − commission)"
              value={fmt(s.effective_shop)}
              icon="🍩"
              color="#10B981"
              indent={false}
              note={s.refund_amount > 0 ? `After ${s.refund_ratio_pct.toFixed(1)}% refund haircut` : `${s.commission_rate_pct}% platform commission`}
            />
            <WaterfallRow
              label="Driver earns"
              value={fmt(s.driver_earnings)}
              icon="🚗"
              color="#FF8C00"
              note={`${driverName} · base ${fmt(s.driver_base_pay)} + ${s.driver_distance_miles.toFixed(2)}mi + ${fmt(s.driver_tip_passthrough)} tip`}
            />
            <WaterfallRow
              label="Tax to remit (TX Comptroller)"
              value={fmt(s.effective_tax)}
              icon="🧾"
              color="#6B7280"
              note="Sits in platform Stripe balance until quarterly remittance"
            />
            {s.refund_amount > 0 && (
              <WaterfallRow
                label="Refund paid out"
                value={`−${fmt(s.refund_amount)}`}
                icon="↩️"
                color="#DC2626"
              />
            )}
            <WaterfallRow
              label="Platform keeps"
              value={fmt(s.platform_net_keep)}
              icon="💰"
              color={s.platform_net_keep >= 0 ? '#6366F1' : '#DC2626'}
              big
              divider
              note="Application fee − Stripe fee − driver payout − tax − refund"
            />
          </>
        )}
      </Card>

      {/* Downstream payouts */}
      <Card title="Downstream payout status">
        {trace.payouts.items.length === 0 ? (
          <div style={{ padding: 16, background: '#FEF3C7', borderRadius: 8, color: '#92400E', fontSize: 13 }}>
            Not yet in any weekly payout batch. Will be picked up by <code>/api/cron/weekly-payout</code> next Monday.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#6B7280', fontWeight: 600 }}>Recipient</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#6B7280', fontWeight: 600 }}>Amount</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#6B7280', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#6B7280', fontWeight: 600 }}>Week</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#6B7280', fontWeight: 600 }}>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {trace.payouts.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: 8 }}>{item.kind}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{fmt(Number(item.amount))}</td>
                  <td style={{ padding: 8 }}>{item.status}</td>
                  <td style={{ padding: 8, color: '#6B7280' }}>{item.week_start ?? '—'} → {item.week_end ?? '—'}</td>
                  <td style={{ padding: 8, color: '#6B7280' }}>{item.paid_at ? new Date(item.paid_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, value, subtle = false, bold = false, color }: { label: string; value: string; subtle?: boolean; bold?: boolean; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '6px 0',
      fontSize: 14,
      color: color || (subtle ? '#6B7280' : '#111827'),
      fontWeight: bold ? 800 : 400,
      borderTop: bold ? '1px solid #E5E7EB' : 'none',
      marginTop: bold ? 8 : 0,
      paddingTop: bold ? 12 : 6,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function WaterfallRow({ label, value, icon, color, big = false, indent = false, divider = false, note }: {
  label: string; value: string; icon?: string; color: string;
  big?: boolean; indent?: boolean; divider?: boolean; note?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: big ? '14px 12px' : '10px 12px',
      paddingLeft: indent ? 36 : 12,
      borderTop: divider ? `1px solid #E5E7EB` : 'none',
      marginTop: divider ? 6 : 0,
    }}>
      {icon && <div style={{ fontSize: big ? 22 : 18 }}>{icon}</div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: big ? 15 : 14, fontWeight: big ? 700 : 500, color: '#111827' }}>{label}</div>
        {note && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{note}</div>}
      </div>
      <div style={{
        fontSize: big ? 22 : 16, fontWeight: 800,
        color, fontFamily: 'monospace',
      }}>
        {value}
      </div>
    </div>
  )
}

function KV({ label, value, copyable = false, mono = false }: { label: string; value: string | null; copyable?: boolean; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
      <span style={{
        fontSize: 12, color: '#374151',
        fontFamily: mono ? 'monospace' : 'inherit',
        cursor: copyable ? 'pointer' : 'default',
      }} onClick={copyable ? () => navigator.clipboard.writeText(value) : undefined} title={copyable ? 'Click to copy' : undefined}>
        {value}{copyable && ' 📋'}
      </span>
    </div>
  )
}
