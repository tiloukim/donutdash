'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Owed {
  stripe: {
    available: number
    pending: number
    total: number
    error: string | null
  }
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
    stripe_minus_obligations: number
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

  const trueKeep = data.net_position.stripe_minus_obligations
  const keepIsNegative = trueKeep < 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Platform Cash Reconciliation</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          What&apos;s actually yours after earmarking driver payouts + tax remittance.
        </p>
      </div>

      {/* Hero card — true keep */}
      <div style={{
        background: keepIsNegative
          ? 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)'
          : 'linear-gradient(135deg, #DCFCE7 0%, #86EFAC 100%)',
        borderRadius: 16, padding: 32, marginBottom: 24,
        border: `2px solid ${keepIsNegative ? '#DC2626' : '#10B981'}`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: keepIsNegative ? '#991B1B' : '#065F46', letterSpacing: 1, marginBottom: 8 }}>
          TRUE PLATFORM KEEP (STRIPE − OBLIGATIONS)
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: keepIsNegative ? '#991B1B' : '#065F46', fontFamily: 'monospace' }}>
          {fmt(trueKeep)}
        </div>
        <div style={{ fontSize: 12, color: keepIsNegative ? '#7F1D1D' : '#047857', marginTop: 8, lineHeight: 1.5 }}>
          {keepIsNegative
            ? `⚠️ Negative — Stripe balance is short of what's owed to drivers + TX Comptroller by ${fmt(-trueKeep)}. New incoming orders need to cover the gap before any payouts to Mercury are spendable.`
            : data.net_position.note}
        </div>
      </div>

      {/* Three-column breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="On Stripe"
          value={fmt(data.stripe.total)}
          sub={`${fmt(data.stripe.available)} avail · ${fmt(data.stripe.pending)} pending`}
          color="#6366F1"
          icon="💳"
          error={data.stripe.error}
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

      {/* Shop payouts (Connect-instant, should be ~0) */}
      {data.obligations.shop_owed > 0.01 && (
        <Card title="🏪 Shop payouts owed">
          <Row label="Outstanding to shops" value={fmt(data.obligations.shop_owed)} bold color="#10B981" />
          <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
            For Stripe Connect destination charges, shops are paid INSTANTLY at charge time — this number should be ~$0. If it&apos;s not, you have non-Connect orders (pickup-only or legacy) that need manual payout.
          </div>
        </Card>
      )}

      {/* Footnotes */}
      <div style={{ marginTop: 24, padding: 16, background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
        <strong>What this page doesn&apos;t show:</strong> your Mercury bank balance. Past Stripe payouts that already landed at Mercury aren&apos;t counted here — but neither are the driver/tax payouts you&apos;ve already paid out from Mercury. The math reconciles either way: <strong>cash anywhere</strong> minus <strong>obligations anywhere</strong> = true keep. This page only shows the Stripe-side slice.
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
