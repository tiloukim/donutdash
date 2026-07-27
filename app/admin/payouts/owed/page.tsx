'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Owed {
  obligations: {
    driver_owed: number
    driver_total_earned: number
    driver_paid_via_batches: number
    driver_paid_via_instant: number
    tax_owed: number
    tax_year: number
    shop_owed: number
  }
  net_position: {
    total_obligations: number
    note: string
  }
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function OwedPage() {
  const [data, setData] = useState<Owed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/payouts/owed')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: '#6B7280' }}>Loading reconciliation…</div>
  if (error) return (
    <div style={{ padding: 32, color: '#991B1B', background: '#FEE2E2', borderRadius: 12 }}>{error}</div>
  )
  if (!data) return null

  const totalObligations = data.net_position.total_obligations

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Platform Obligations</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          Earmarked against platform cash: driver payouts + tax remittance + shop payouts.
        </p>
      </div>

      {/* Hero card — total obligations */}
      <div style={{
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%)',
        borderRadius: 16, padding: 32, marginBottom: 24,
        border: '2px solid #F59E0B',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E', letterSpacing: 1, marginBottom: 8 }}>
          TOTAL OBLIGATIONS (DRIVERS + TAX + SHOPS)
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: '#92400E', fontFamily: 'monospace' }}>
          {fmt(totalObligations)}
        </div>
        <div style={{ fontSize: 12, color: '#B45309', marginTop: 8, lineHeight: 1.5 }}>
          {data.net_position.note}
        </div>
      </div>

      {/* Three-column breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Owed to shops"
          value={fmt(data.obligations.shop_owed)}
          sub="Food-sales earnings − batch payouts"
          color="#10B981"
          icon="🏪"
        />
        <StatCard
          label="Owed to drivers"
          value={fmt(data.obligations.driver_owed)}
          sub={`${fmt(data.obligations.driver_total_earned)} earned − payouts`}
          color="#FF8C00"
          icon="🚗"
        />
        <StatCard
          label={`Owed to TX Comptroller (${data.obligations.tax_year})`}
          value={fmt(data.obligations.tax_owed)}
          sub="Tax collected YTD, untracked remittance"
          color="#0EA5E9"
          icon="🧾"
        />
      </div>

      {/* Driver detail */}
      <Card title="🚗 Driver payouts">
        <Row label="Total earned (delivered)" value={fmt(data.obligations.driver_total_earned)} />
        <Row label="Paid via weekly batches" value={`−${fmt(data.obligations.driver_paid_via_batches)}`} color="#10B981" />
        <Row label="Paid via instant cashout" value={`−${fmt(data.obligations.driver_paid_via_instant)}`} color="#10B981" />
        <Row label="Outstanding to drivers" value={fmt(data.obligations.driver_owed)} bold color="#FF8C00" />
        <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
          Next weekly batch fires Monday via <code>/api/cron/weekly-payout</code>.{' '}
          <Link href="/admin/payouts" style={{ color: '#6366F1' }}>View payouts dashboard →</Link>
        </div>
      </Card>

      {/* Tax detail */}
      <Card title="🧾 Tax owed to TX Comptroller">
        <Row label={`Tax collected ${data.obligations.tax_year} YTD`} value={fmt(data.obligations.tax_owed)} bold color="#0EA5E9" />
        <div style={{ marginTop: 12, padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
          ⚠️ <strong>No remittance tracking exists yet.</strong> This number assumes $0 has been remitted to TX Comptroller this year. If you&apos;ve made quarterly payments, subtract them mentally. A proper remittance log table would fix this.{' '}
          <Link href="/admin/tax" style={{ color: '#92400E', textDecoration: 'underline' }}>View tax center →</Link>
        </div>
      </Card>

      {/* Shop payouts owed (batch model) */}
      {data.obligations.shop_owed > 0.01 && (
        <Card title="🏪 Shop payouts owed">
          <Row label="Outstanding to shops" value={fmt(data.obligations.shop_owed)} bold color="#10B981" />
          <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
            Payments run through Square, so shops are paid via the batch payout system.{' '}
            <Link href="/admin/payouts" style={{ color: '#6366F1' }}>View payouts dashboard →</Link>
          </div>
        </Card>
      )}

      {/* Footnotes */}
      <div style={{ marginTop: 24, padding: 16, background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
        <strong>Platform cash</strong> is held in your Square account (check the Square dashboard for the live balance). This page tracks the <strong>obligations</strong> earmarked against it — what you still owe drivers, the TX Comptroller, and shops.
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, icon, error }: {
  label: string; value: string; sub?: string; color: string; icon: string; error?: string | null;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
      {error && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>⚠ {error}</div>}
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

function Row({ label, value, bold = false, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
      fontSize: 14,
      color: color || (bold ? '#111827' : '#374151'),
      fontWeight: bold ? 800 : 400,
      borderTop: bold ? '1px solid #E5E7EB' : 'none',
      marginTop: bold ? 8 : 0,
      paddingTop: bold ? 12 : 8,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
