'use client'

import { useState, useEffect } from 'react'

interface PayoutRequest {
  id: string
  amount: number
  payment_method: string
  payment_info: string
  status: string
  notes: string | null
  admin_notes: string | null
  created_at: string
  paid_at: string | null
}

export default function DriverEarnings() {
  const [data, setData] = useState<{ today: number; thisWeek: number; allTime: number; availableBalance: number; referralCredit: number; deliveries: any[] }>({ today: 0, thisWeek: 0, allTime: 0, availableBalance: 0, referralCredit: 0, deliveries: [] })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Payout request state
  const [showPayoutForm, setShowPayoutForm] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer')
  const [payoutInfo, setPayoutInfo] = useState('')
  const [bankRoutingNumber, setBankRoutingNumber] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountHolder, setBankAccountHolder] = useState('')
  const [payoutNotes, setPayoutNotes] = useState('')
  const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState('')
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [payoutSuccess, setPayoutSuccess] = useState('')
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([])

  useEffect(() => {
    fetch('/api/driver/earnings').then(r => r.json()).then(setData).finally(() => setLoading(false))
    fetch('/api/driver/payout').then(r => r.json()).then(d => setPayoutRequests(d.requests || [])).catch(() => {})
  }, [])

  const handleRequestPayout = async () => {
    const amt = parseFloat(payoutAmount)
    if (!amt || amt <= 0) { setPayoutError('Enter a valid amount'); return }
    if (amt > data.availableBalance) { setPayoutError(`Amount exceeds available balance ($${data.availableBalance.toFixed(2)})`); return }
    if (payoutMethod === 'bank_transfer') {
      if (!bankAccountHolder.trim()) { setPayoutError('Enter the account holder name'); return }
      if (!bankRoutingNumber.trim()) { setPayoutError('Enter the routing number'); return }
      if (!bankAccountNumber.trim()) { setPayoutError('Enter the account number'); return }
      if (confirmBankAccountNumber !== bankAccountNumber) { setPayoutError('Account numbers do not match'); return }
    } else if (!payoutInfo.trim()) { setPayoutError('Enter your payment info'); return }
    setPayoutSubmitting(true)
    setPayoutError('')
    try {
      const res = await fetch('/api/driver/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          payment_method: payoutMethod,
          payment_info: payoutMethod === 'bank_transfer'
            ? `Name: ${bankAccountHolder.trim()}, Routing: ${bankRoutingNumber.trim()}, Account: ${bankAccountNumber.trim()}`
            : payoutInfo,
          notes: payoutNotes,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setPayoutSuccess('Payout request submitted!')
        setShowPayoutForm(false)
        setPayoutAmount(''); setPayoutInfo(''); setPayoutNotes('')
        setBankRoutingNumber(''); setBankAccountNumber(''); setBankAccountHolder(''); setConfirmBankAccountNumber('')
        setPayoutRequests(prev => [d.request, ...prev])
        setTimeout(() => setPayoutSuccess(''), 5000)
      } else {
        setPayoutError(d.error || 'Failed to submit')
      }
    } catch { setPayoutError('Failed to submit') }
    finally { setPayoutSubmitting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ color: '#FF8C00', fontWeight: 600 }}>Loading earnings...</div>
    </div>
  )

  const cards = [
    { label: 'Today', value: data.today, color: '#10B981' },
    { label: 'This Week', value: data.thisWeek, color: '#FF8C00' },
    { label: 'All Time', value: data.allTime, color: '#6366F1' },
    { label: 'Available Balance', value: data.availableBalance, color: '#10B981' },
    ...(data.referralCredit > 0 ? [{ label: 'Referral Credit', value: data.referralCredit, color: '#EC4899' }] : []),
    { label: 'Total Deliveries', value: data.deliveries.length, color: '#FF8C00', isCount: true },
  ]

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const getBreakdown = (d: any) => {
    const basePay = d.base_pay ?? 3.00
    const tip = d.order?.tip ?? 0
    const total = d.driver_earnings ?? 4.00
    const distanceBonus = Math.max(0, total - basePay - tip)
    return { basePay, tip, distanceBonus, total }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    }
  }

  // Build daily earnings chart data from deliveries (last 14 days)
  const dailyEarnings: { label: string; amount: number }[] = (() => {
    const days: { label: string; amount: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const amount = data.deliveries
        .filter((del: any) => (del.delivered_at || del.created_at || '').slice(0, 10) === key)
        .reduce((sum: number, del: any) => sum + (del.driver_earnings ?? 0), 0)
      days.push({ label, amount })
    }
    return days
  })()
  const maxEarning = Math.max(...dailyEarnings.map(d => d.amount), 1)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>
              {(c as any).isCount ? c.value : `$${(c.value as number).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Daily Earnings Chart */}
      {data.deliveries.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>Last 14 Days</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {dailyEarnings.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {d.amount > 0 && (
                  <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }}>${d.amount.toFixed(0)}</span>
                )}
                <div style={{
                  width: '100%',
                  maxWidth: 28,
                  height: Math.max(2, (d.amount / maxEarning) * 90),
                  background: d.amount > 0 ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)' : '#f0f0f0',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s',
                }} />
                <span style={{ fontSize: 8, color: '#aaa', whiteSpace: 'nowrap' }}>
                  {i % 2 === 0 ? d.label : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Payout Section */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPayoutForm ? 16 : 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Request Payout</h3>
          {!showPayoutForm && (
            <button onClick={() => setShowPayoutForm(true)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Request Payout
            </button>
          )}
        </div>

        {payoutSuccess && <div style={{ background: '#D1FAE5', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#065F46', fontSize: 14 }}>{payoutSuccess}</div>}
        {payoutError && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#DC2626', fontSize: 14 }}>{payoutError}</div>}

        {showPayoutForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Amount ($)</label>
              <input type="number" step="0.01" max={data.availableBalance} placeholder="0.00" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, outline: 'none' }} />
              <div style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>Available: ${data.availableBalance.toFixed(2)}</div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Payment Method</label>
              <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Account Holder Name</label>
              <input type="text" placeholder="John Doe" value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Routing Number</label>
              <input type="text" placeholder="9 digits" value={bankRoutingNumber} onChange={e => setBankRoutingNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Account Number</label>
              <input type="password" placeholder="Account number" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Confirm Account Number</label>
              <input type="password" placeholder="Re-enter account number" value={confirmBankAccountNumber} onChange={e => setConfirmBankAccountNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: confirmBankAccountNumber && confirmBankAccountNumber !== bankAccountNumber ? '1px solid #DC2626' : '1px solid #ddd', fontSize: 14, outline: 'none' }} />
              {confirmBankAccountNumber && confirmBankAccountNumber !== bankAccountNumber && (
                <div style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>Account numbers do not match.</div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
              <input type="text" placeholder="Any notes for admin" value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRequestPayout} disabled={payoutSubmitting} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                {payoutSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button onClick={() => { setShowPayoutForm(false); setPayoutError('') }} style={{
                padding: '12px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Previous Requests */}
        {payoutRequests.length > 0 && !showPayoutForm && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 8 }}>Recent Requests</p>
            {payoutRequests.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>${r.amount.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{r.payment_method} → {r.payment_info}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                  background: r.status === 'paid' ? '#D1FAE5' : r.status === 'pending' ? '#FEF3C7' : r.status === 'rejected' ? '#FEE2E2' : '#DBEAFE',
                  color: r.status === 'paid' ? '#065F46' : r.status === 'pending' ? '#92400E' : r.status === 'rejected' ? '#DC2626' : '#1E40AF',
                }}>
                  {r.status === 'paid' ? `Paid ${r.paid_at ? new Date(r.paid_at).toLocaleDateString() : ''}` : r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE8D6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Completed Deliveries</h3>
          <span style={{ fontSize: 13, color: '#888' }}>{data.deliveries.length} total</span>
        </div>
        {data.deliveries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No completed deliveries yet</div>
        ) : (
          data.deliveries.map((d: any) => {
            const isExpanded = expandedId === d.id
            const breakdown = getBreakdown(d)
            const dt = formatDateTime(d.delivered_at || d.created_at)

            return (
              <div key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div
                  onClick={() => toggleExpand(d.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: isExpanded ? '#FFF8F0' : '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{d.order?.shop?.name || 'Shop'}</span>
                      {d.distance_miles != null && (
                        <span style={{ fontSize: 11, color: '#FF8C00', background: '#FFF3E6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          {d.distance_miles.toFixed(1)} mi
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{d.order?.delivery_address || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{dt.date} at {dt.time}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#10B981', fontSize: 17 }}>${breakdown.total.toFixed(2)}</span>
                    <span style={{
                      display: 'inline-block',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: isExpanded ? 'none' : '6px solid #ccc',
                      borderBottom: isExpanded ? '6px solid #FF8C00' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 20px 16px 20px', background: '#FFF8F0' }}>
                    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #FFE8D6', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Base Pay</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>${breakdown.basePay.toFixed(2)}</span>
                      </div>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Distance Bonus</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: breakdown.distanceBonus > 0 ? '#FF8C00' : '#888' }}>
                          {breakdown.distanceBonus > 0 ? '+' : ''}${breakdown.distanceBonus.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Tip</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: breakdown.tip > 0 ? '#10B981' : '#888' }}>
                          {breakdown.tip > 0 ? '+' : ''}${breakdown.tip.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', background: '#FAFAFA' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Total Earned</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>${breakdown.total.toFixed(2)}</span>
                      </div>
                    </div>
                    {d.distance_miles != null && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#888', textAlign: 'right' }}>
                        Distance: {d.distance_miles.toFixed(1)} miles
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
