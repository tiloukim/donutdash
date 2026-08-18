'use client'

import { useEffect, useState } from 'react'

interface PayoutBatch {
  id: string
  week_start: string
  week_end: string
  status: string
  total_driver_payouts: number
  total_shop_payouts: number
  total_amount: number
  created_at: string
  processed_at: string | null
  // Derived by the API from the batch's items:
  paid_count?: number
  pending_count?: number
  skipped_count?: number
  item_count?: number
  paid_amount?: number
  pending_amount?: number
}

// Status → pill styling + human label. Batches can be pending, partially paid
// (some items paid one-by-one but not all), or completed.
function batchStatusMeta(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'completed': return { bg: '#D1FAE5', color: '#065F46', label: 'completed' }
    case 'partially_paid': return { bg: '#DBEAFE', color: '#1E40AF', label: 'partially paid' }
    case 'processing': return { bg: '#DBEAFE', color: '#1E40AF', label: 'processing' }
    default: return { bg: '#FEF3C7', color: '#92400E', label: 'pending' }
  }
}

interface PayoutItem {
  id: string
  user_id: string
  user_type: string
  shop_id: string | null
  amount: number
  earnings_breakdown: any
  bank_info: { method?: string | null; holder?: string | null; routing?: string | null; account?: string | null; paypal?: string | null; venmo?: string | null; cashapp?: string | null; _live?: boolean } | null
  status: string
  notes: string | null
  paid_at: string | null
  user: { name: string; email: string; phone: string | null }
  shop: { name: string } | null
}

interface PeriodData {
  summary: {
    totalRevenue: number
    totalShopPayouts: number
    totalDriverPayouts: number
    platformProfit: number
    totalOrders: number
  }
  shopPayouts: any[]
  driverPayouts: any[]
}

const fmt = (n: number) => `$${n.toFixed(2)}`

// The last N weeks (Mon-Sun) the admin can generate a batch for — lets them
// catch up on older weeks, not just the previous one.
function recentWeeks(count = 12): { value: string; label: string }[] {
  const now = new Date()
  const dow = now.getDay()
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))
  thisMonday.setHours(0, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const ws = new Date(thisMonday); ws.setDate(thisMonday.getDate() - 7 * i)
    const we = new Date(ws); we.setDate(ws.getDate() + 6)
    const value = `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`
    const label = i === 0 ? `This week (${fmt(ws)}–${fmt(we)}, partial)` : i === 1 ? `Last week (${fmt(ws)}–${fmt(we)})` : `${fmt(ws)}–${fmt(we)}`
    out.push({ value, label })
  }
  return out
}

export default function PayoutsPage() {
  const [tab, setTab] = useState<'overview' | 'requests' | 'batches'>('overview')
  const [selectedWeek, setSelectedWeek] = useState<string>(() => recentWeeks()[1]?.value || '')
  const [period, setPeriod] = useState('week')
  const [periodData, setPeriodData] = useState<PeriodData | null>(null)
  const [batches, setBatches] = useState<PayoutBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<PayoutBatch | null>(null)
  const [batchItems, setBatchItems] = useState<PayoutItem[]>([])
  const [payoutRequests, setPayoutRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Fetch period overview
  useEffect(() => {
    if (tab === 'overview') {
      setLoading(true)
      fetch(`/api/admin/payouts?period=${period}`)
        .then(r => r.json())
        .then(setPeriodData)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [period, tab])

  // Fetch payout requests
  useEffect(() => {
    if (tab === 'requests') {
      setLoading(true)
      fetch('/api/admin/payout-requests')
        .then(r => r.json())
        .then(d => setPayoutRequests(d.requests || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [tab])

  const handleRequestAction = async (requestId: string, status: 'approved' | 'paid' | 'rejected', adminNotes?: string) => {
    setProcessing(requestId)
    try {
      const res = await fetch('/api/admin/payout-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, admin_notes: adminNotes }),
      })
      if (res.ok) {
        setPayoutRequests(prev => prev.map(r => r.id === requestId ? { ...r, status, paid_at: status === 'paid' ? new Date().toISOString() : r.paid_at } : r))
        setMessage(`Request ${status}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {}
    finally { setProcessing(null) }
  }

  // Fetch batches
  useEffect(() => {
    if (tab === 'batches') {
      setLoading(true)
      fetch('/api/admin/payout-batch')
        .then(r => r.json())
        .then(d => setBatches(d.batches || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [tab])

  const fetchBatchDetails = async (batch: PayoutBatch) => {
    setSelectedBatch(batch)
    const res = await fetch(`/api/admin/payout-batch/${batch.id}`)
    const data = await res.json()
    setBatchItems(data.items || [])
  }

  const generateBatch = async (weekStart?: string) => {
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/payout-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', ...(weekStart ? { weekStart } : {}) }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Batch generated with ${data.itemCount} payout items`)
        setBatches(prev => [data.batch, ...prev])
      } else {
        setError(data.error || 'Failed to generate')
      }
    } catch { setError('Failed to generate batch') }
    finally { setGenerating(false) }
  }

  const payItem = async (itemId: string) => {
    setProcessing(itemId)
    try {
      const res = await fetch('/api/admin/payout-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay_item', itemId }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const newItems = batchItems.map(i => i.id === itemId ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i)
        setBatchItems(newItems)
        // Keep the batch status in sync with the API's derived value so the list
        // and header reflect partially-paid / completed without a refresh.
        if (data.batchStatus && selectedBatch) {
          const paidAmt = newItems.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
          const pendingAmt = newItems.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount || 0), 0)
          setSelectedBatch(prev => prev ? { ...prev, status: data.batchStatus, paid_amount: paidAmt, pending_amount: pendingAmt } : prev)
          setBatches(prev => prev.map(b => b.id === selectedBatch.id ? { ...b, status: data.batchStatus, paid_amount: paidAmt, pending_amount: pendingAmt, pending_count: newItems.filter(i => i.status === 'pending').length } : b))
        }
      }
    } catch {}
    finally { setProcessing(null) }
  }

  const payAll = async (batchId: string) => {
    if (!confirm('Mark all pending items as paid? Make sure you have sent all bank transfers first.')) return
    setProcessing('all')
    try {
      const res = await fetch('/api/admin/payout-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay_all', batchId }),
      })
      if (res.ok) {
        setBatchItems(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
        setSelectedBatch(prev => prev ? { ...prev, status: 'completed' } : null)
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'completed' } : b))
        setMessage('All payouts marked as paid!')
        setTimeout(() => setMessage(''), 4000)
      }
    } catch {}
    finally { setProcessing(null) }
  }


  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setTab('overview'); setSelectedBatch(null) }} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          background: tab === 'overview' ? '#6366F1' : '#F3F4F6', color: tab === 'overview' ? '#fff' : '#6B7280',
        }}>Earnings Overview</button>
        <button onClick={() => setTab('requests')} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          background: tab === 'requests' ? '#6366F1' : '#F3F4F6', color: tab === 'requests' ? '#fff' : '#6B7280',
        }}>
          Payout Requests
          {payoutRequests.filter(r => r.status === 'pending').length > 0 && (
            <span style={{ marginLeft: 6, background: '#EF4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>
              {payoutRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('batches')} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          background: tab === 'batches' ? '#6366F1' : '#F3F4F6', color: tab === 'batches' ? '#fff' : '#6B7280',
        }}>Weekly Payouts</button>
      </div>

      {message && <div style={{ background: '#D1FAE5', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#065F46', fontSize: 14 }}>{message}</div>}
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#DC2626', fontSize: 14 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <a href="/admin/payouts/owed" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 8,
          background: '#6366F1', color: '#fff', textDecoration: 'none',
          fontSize: 14, fontWeight: 700,
        }}>
          💰 Cash Reconciliation — what&apos;s actually yours →
        </a>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: period === p ? '#6366F1' : '#F3F4F6', color: period === p ? '#fff' : '#6B7280',
              }}>
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div> : periodData && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                <SummaryCard label="Total Revenue" value={fmt(periodData.summary.totalRevenue)} color="#10B981" />
                <SummaryCard label="Shop Payouts" value={fmt(periodData.summary.totalShopPayouts)} color="#FF8C00" />
                <SummaryCard label="Driver Payouts" value={fmt(periodData.summary.totalDriverPayouts)} color="#3B82F6" />
                <SummaryCard label="Platform Profit" value={fmt(periodData.summary.platformProfit)} color="#6366F1" />
                <SummaryCard label="Orders" value={String(periodData.summary.totalOrders)} color="#8B5CF6" />
              </div>

              {/* Shop payouts table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>Shop Earnings</h3>
                {periodData.shopPayouts.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 20 }}>No shop earnings this period</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                        {['Shop', 'Orders', 'Sales', 'Commission', 'Owed'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodData.shopPayouts.map((s: any) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={tdStyle}><strong>{s.name}</strong></td>
                          <td style={tdStyle}>{s.orders}</td>
                          <td style={tdStyle}>{fmt(s.subtotal)}</td>
                          <td style={tdStyle}>{fmt(s.commission)}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: '#FF8C00' }}>{fmt(s.payout)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Driver payouts table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>Driver Earnings</h3>
                {periodData.driverPayouts.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 20 }}>No driver earnings this period</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                        {['Driver', 'Deliveries', 'Base Pay', 'Tips', 'Total Owed'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodData.driverPayouts.map((d: any) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={tdStyle}><strong>{d.name}</strong></td>
                          <td style={tdStyle}>{d.deliveries}</td>
                          <td style={tdStyle}>{fmt(d.basePay)}</td>
                          <td style={tdStyle}>{fmt(d.tips)}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: '#3B82F6' }}>{fmt(d.earnings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Payout Requests Tab */}
      {tab === 'requests' && (
        <>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div> : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              {payoutRequests.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No payout requests</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                      {['Driver/Shop', 'Role', 'Amount', 'Payment Method', 'Payment Info', 'Notes', 'Status', 'Requested', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRequests.map(req => (
                      <tr key={req.id} style={{ borderBottom: '1px solid #F3F4F6', background: req.status === 'pending' ? '#FFFBEB' : undefined }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{req.user?.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{req.user?.email}</div>
                          {req.user?.phone && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{req.user.phone}</div>}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            background: req.role === 'driver' ? '#DBEAFE' : '#FCE7F3',
                            color: req.role === 'driver' ? '#1E40AF' : '#9D174D',
                          }}>
                            {req.role === 'driver' ? 'Driver' : 'Shop'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, fontSize: 16, color: '#10B981' }}>{fmt(Number(req.amount))}</td>
                        <td style={{ ...tdStyle, fontSize: 13 }}>{req.payment_method}</td>
                        <td style={{ ...tdStyle, fontSize: 12, maxWidth: 200, wordBreak: 'break-all' as const }}>{req.payment_info}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: '#6B7280' }}>{req.notes || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                            background: req.status === 'paid' ? '#D1FAE5' : req.status === 'pending' ? '#FEF3C7' : req.status === 'rejected' ? '#FEE2E2' : '#DBEAFE',
                            color: req.status === 'paid' ? '#065F46' : req.status === 'pending' ? '#92400E' : req.status === 'rejected' ? '#DC2626' : '#1E40AF',
                          }}>
                            {req.status}{req.paid_at ? ` ${new Date(req.paid_at).toLocaleDateString()}` : ''}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td style={tdStyle}>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleRequestAction(req.id, 'paid')} disabled={processing === req.id}
                                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                Mark Paid
                              </button>
                              <button onClick={() => handleRequestAction(req.id, 'rejected')} disabled={processing === req.id}
                                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                Reject
                              </button>
                            </div>
                          )}
                          {req.status === 'approved' && (
                            <button onClick={() => handleRequestAction(req.id, 'paid')} disabled={processing === req.id}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Batches Tab */}
      {tab === 'batches' && !selectedBatch && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Weekly Payout Batches</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                disabled={generating}
                style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, background: '#fff', cursor: 'pointer' }}
              >
                {recentWeeks().map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <button onClick={() => generateBatch(selectedWeek || undefined)} disabled={generating} style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', whiteSpace: 'nowrap',
              }}>
                {generating ? 'Generating...' : 'Generate Batch'}
              </button>
            </div>
          </div>

          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div> : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              {batches.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                  No batches yet. Click "Generate" to create this week&apos;s payout batch.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                      {['Week', 'Shop Payouts', 'Driver Payouts', 'Total', 'Status', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map(batch => (
                      <tr key={batch.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={tdStyle}>
                          <strong>{new Date(batch.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
                          <span style={{ color: '#9CA3AF' }}> — </span>
                          <span>{new Date(batch.week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </td>
                        <td style={tdStyle}>{fmt(batch.total_shop_payouts)}</td>
                        <td style={tdStyle}>{fmt(batch.total_driver_payouts)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(batch.total_amount)}</td>
                        <td style={tdStyle}>
                          {(() => {
                            const meta = batchStatusMeta(batch.status)
                            const hasCounts = typeof batch.item_count === 'number' && batch.item_count > 0
                            return (
                              <>
                                <span style={{
                                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                  background: meta.bg, color: meta.color,
                                }}>
                                  {meta.label}
                                </span>
                                {hasCounts && batch.status !== 'completed' && (
                                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                                    {fmt(batch.paid_amount || 0)} of {fmt(batch.total_amount)} paid · {batch.pending_count} left
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => fetchBatchDetails(batch)} style={{
                            padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6366F1',
                          }}>
                            View & Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Batch Detail View */}
      {tab === 'batches' && selectedBatch && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <button onClick={() => { setSelectedBatch(null); setBatchItems([]) }} style={{
                background: 'none', border: 'none', color: '#6366F1', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 8,
              }}>
                &larr; Back to Batches
              </button>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Week of {new Date(selectedBatch.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
            </div>
            {selectedBatch.status !== 'completed' && batchItems.some(i => i.status === 'pending') && (() => {
              const remaining = batchItems.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount || 0), 0)
              return (
                <button onClick={() => payAll(selectedBatch.id)} disabled={processing === 'all'} style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {processing === 'all' ? 'Processing...' : `Mark Remaining as Paid (${fmt(remaining)})`}
                </button>
              )
            })()}
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <SummaryCard label="Shop Payouts" value={fmt(selectedBatch.total_shop_payouts)} color="#FF8C00" />
            <SummaryCard label="Driver Payouts" value={fmt(selectedBatch.total_driver_payouts)} color="#3B82F6" />
            <SummaryCard label="Total" value={fmt(selectedBatch.total_amount)} color="#6366F1" />
            <SummaryCard label="Paid" value={`${batchItems.filter(i => i.status === 'paid').length}/${batchItems.length}`} color="#10B981" />
          </div>

          {/* Payout items */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                  {['Type', 'Name', 'Details', 'Amount', 'Bank Info', 'Status', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchItems.map(item => {
                  const breakdown = item.earnings_breakdown || {}
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6', background: item.status === 'paid' ? '#F0FDF4' : undefined }}>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: item.user_type === 'driver' ? '#DBEAFE' : '#FCE7F3',
                          color: item.user_type === 'driver' ? '#1E40AF' : '#9D174D',
                        }}>
                          {item.user_type === 'driver' ? 'Driver' : 'Shop'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{item.user?.name || '—'}</div>
                        {item.shop && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.shop.name}</div>}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#6B7280' }}>
                        {item.user_type === 'driver' ? (
                          <>{breakdown.deliveries} deliveries, {fmt(breakdown.basePay || 0)} base + {fmt(breakdown.tips || 0)} tips</>
                        ) : (
                          <>{breakdown.orders} orders, {fmt(breakdown.subtotal || 0)} sales, -{fmt(breakdown.commission || 0)} comm.</>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, fontSize: 16, color: item.user_type === 'driver' ? '#3B82F6' : '#FF8C00' }}>
                        {fmt(item.amount)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        {(() => {
                          const b = item.bank_info
                          const method = b?.method
                          // Full numbers here on purpose — this is the admin-only screen
                          // where you actually execute the transfer, so you need them.
                          const live = b?._live ? <span title="Pulled from the recipient's current settings (added after this batch was generated)" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#0369A1', background: '#E0F2FE', borderRadius: 4, padding: '1px 5px', fontFamily: 'sans-serif' }}>current</span> : null
                          if (method === 'paypal' && b?.paypal) return <div><div style={{ fontWeight: 600 }}>PayPal {live}</div><div style={{ color: '#374151', fontFamily: 'monospace', userSelect: 'all' }}>{b.paypal}</div></div>
                          if (method === 'venmo' && b?.venmo) return <div><div style={{ fontWeight: 600 }}>Venmo {live}</div><div style={{ color: '#374151', fontFamily: 'monospace', userSelect: 'all' }}>{b.venmo}</div></div>
                          if (method === 'cashapp' && b?.cashapp) return <div><div style={{ fontWeight: 600 }}>Cash App {live}</div><div style={{ color: '#374151', fontFamily: 'monospace', userSelect: 'all' }}>{b.cashapp}</div></div>
                          if (b?.holder && b?.routing && b?.account) return (
                            <div style={{ fontFamily: 'monospace' }}>
                              <div style={{ fontWeight: 600, fontFamily: 'inherit' }}>{b.holder} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(ACH)</span> {live}</div>
                              <div style={{ color: '#374151', userSelect: 'all' }}>Routing: {b.routing}</div>
                              <div style={{ color: '#374151', userSelect: 'all' }}>Account: {b.account}</div>
                            </div>
                          )
                          return <span style={{ color: '#EF4444', fontWeight: 600 }}>No payout info</span>
                        })()}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                          background: item.status === 'paid' ? '#D1FAE5' : item.status === 'skipped' ? '#F3F4F6' : '#FEF3C7',
                          color: item.status === 'paid' ? '#065F46' : item.status === 'skipped' ? '#6B7280' : '#92400E',
                        }}>
                          {item.status}{item.paid_at ? ` ${new Date(item.paid_at).toLocaleDateString()}` : ''}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {item.status === 'pending' && (
                          <button onClick={() => payItem(item.id)} disabled={processing === item.id} style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                            {processing === item.id ? '...' : 'Mark Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {batchItems.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No payout items in this batch</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Instructions */}
          <div style={{ marginTop: 20, background: '#F0F9FF', borderRadius: 12, border: '1px solid #BAE6FD', padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0369A1', margin: '0 0 8px 0' }}>How to Process This Batch</h4>
            <ol style={{ fontSize: 13, color: '#0C4A6E', lineHeight: 2, margin: 0, paddingLeft: 20 }}>
              <li>Review each payout amount and bank details above</li>
              <li>Log into your bank and send ACH/wire transfers to each recipient</li>
              <li>Click <strong>"Mark Paid"</strong> on each item after you send the transfer</li>
              <li>Or click <strong>"Mark All as Paid"</strong> once all transfers are sent</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 }
