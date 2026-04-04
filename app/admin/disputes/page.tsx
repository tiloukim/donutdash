'use client'

import { useState, useEffect } from 'react'

const REASON_LABELS: Record<string, string> = {
  wrong_items: 'Wrong Items',
  missing_items: 'Missing Items',
  cold_food: 'Cold Food',
  late_delivery: 'Late Delivery',
  never_delivered: 'Never Delivered',
  damaged: 'Damaged',
  other: 'Other',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFF3CD', color: '#856404' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  rejected: { bg: '#FEE2E2', color: '#991B1B' },
  refunded: { bg: '#DBEAFE', color: '#1E40AF' },
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedDispute, setSelectedDispute] = useState<any>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/admin/disputes')
      if (res.ok) {
        const data = await res.json()
        setDisputes(data.disputes || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchDisputes() }, [])

  const handleAction = async (disputeId: string, status: 'approved' | 'rejected' | 'refunded') => {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispute_id: disputeId, status, admin_notes: adminNotes }),
      })
      if (res.ok) {
        setSelectedDispute(null)
        setAdminNotes('')
        fetchDisputes()
      }
    } catch {}
    setUpdating(false)
  }

  const filtered = filter === 'all' ? disputes : disputes.filter(d => d.status === filter)

  const stats = {
    total: disputes.length,
    pending: disputes.filter(d => d.status === 'pending').length,
    approved: disputes.filter(d => d.status === 'approved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
    refunded: disputes.filter(d => d.status === 'refunded').length,
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading disputes...</div>
  }

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Disputes', value: stats.total, color: '#6366F1', icon: '📋' },
          { label: 'Pending', value: stats.pending, color: '#F59E0B', icon: '⏳' },
          { label: 'Approved', value: stats.approved, color: '#10B981', icon: '✅' },
          { label: 'Rejected', value: stats.rejected, color: '#EF4444', icon: '❌' },
          { label: 'Refunded', value: stats.refunded, color: '#3B82F6', icon: '💸' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: 12, padding: 20,
            border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E' }}>{card.value}</div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: card.color + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected', 'refunded'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: filter === f ? '#6366F1' : '#fff',
              color: filter === f ? '#fff' : '#666',
              boxShadow: filter === f ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' ? `(${stats[f as keyof typeof stats]})` : ''}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12,
          border: '1px solid #E5E7EB', color: '#999',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No disputes{filter !== 'all' ? ` with status "${filter}"` : ''}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(dispute => {
            const statusStyle = STATUS_COLORS[dispute.status] || STATUS_COLORS.pending
            const isExpanded = selectedDispute?.id === dispute.id

            return (
              <div key={dispute.id} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
              }}>
                {/* Dispute Header */}
                <div
                  onClick={() => {
                    if (isExpanded) {
                      setSelectedDispute(null)
                      setAdminNotes('')
                    } else {
                      setSelectedDispute(dispute)
                      setAdminNotes(dispute.admin_notes || '')
                    }
                  }}
                  style={{
                    padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: '#FFF0F5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      ⚠️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>
                          {dispute.customer?.name || 'Unknown'}
                        </span>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: statusStyle.bg, color: statusStyle.color,
                        }}>
                          {dispute.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {REASON_LABELS[dispute.reason] || dispute.reason}
                        {' · '}
                        Order #{dispute.order_id?.slice(0, 8)}
                        {dispute.order?.shop?.name ? ` · ${dispute.order.shop.name}` : ''}
                        {' · '}
                        {new Date(dispute.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#EF4444' }}>
                        ${Number(dispute.refund_amount).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>requested</div>
                    </div>
                  </div>
                  <span style={{ marginLeft: 12, fontSize: 16, color: '#bbb' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #E5E7EB', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
                          Customer Info
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>{dispute.customer?.name}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>{dispute.customer?.email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
                          Order Info
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>
                          Order #{dispute.order_id?.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          Total: ${Number(dispute.order?.total || 0).toFixed(2)}
                          {dispute.order?.shop?.name ? ` · ${dispute.order.shop.name}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
                        Issue Details
                      </div>
                      <div style={{
                        background: '#F8F9FA', borderRadius: 8, padding: 14,
                        border: '1px solid #E5E7EB',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>
                          {REASON_LABELS[dispute.reason] || dispute.reason}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          {dispute.description || 'No description provided.'}
                        </div>
                      </div>
                    </div>

                    {/* Customer Evidence Photos */}
                    {((dispute.photo_urls as string[])?.length > 0 || dispute.photo_url) && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
                          Customer Evidence Photos
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {((dispute.photo_urls as string[]) || (dispute.photo_url ? [dispute.photo_url] : [])).map((url: string, i: number) => (
                            <img key={i} src={url} alt={`Evidence ${i + 1}`} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E7EB' }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Actions */}
                    {dispute.status === 'pending' ? (
                      <div>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>
                            Admin Notes
                          </div>
                          <textarea
                            value={adminNotes}
                            onChange={e => setAdminNotes(e.target.value)}
                            placeholder="Add notes about your decision..."
                            style={{
                              width: '100%', minHeight: 60, borderRadius: 8,
                              border: '1px solid #E5E7EB', padding: '10px 12px',
                              fontSize: 13, resize: 'vertical', outline: 'none',
                              fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#6366F1' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => handleAction(dispute.id, 'approved')}
                            disabled={updating}
                            style={{
                              flex: 1, padding: '10px 0', borderRadius: 8,
                              background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 13,
                              border: 'none', cursor: 'pointer', opacity: updating ? 0.7 : 1,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            {updating ? '...' : 'Approve Refund'}
                          </button>
                          <button
                            onClick={() => handleAction(dispute.id, 'rejected')}
                            disabled={updating}
                            style={{
                              flex: 1, padding: '10px 0', borderRadius: 8,
                              background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13,
                              border: 'none', cursor: 'pointer', opacity: updating ? 0.7 : 1,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            {updating ? '...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {dispute.admin_notes && (
                          <div style={{
                            background: '#F8F9FA', borderRadius: 8, padding: 14,
                            border: '1px solid #E5E7EB', marginBottom: 12,
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>
                              Admin Notes
                            </div>
                            <div style={{ fontSize: 13, color: '#666' }}>{dispute.admin_notes}</div>
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#888' }}>
                          Resolved by {dispute.resolver?.name || 'Admin'}
                          {dispute.resolved_at ? ` on ${new Date(dispute.resolved_at).toLocaleDateString()}` : ''}
                        </div>
                        {dispute.status === 'approved' && (
                          <button
                            onClick={() => handleAction(dispute.id, 'refunded')}
                            disabled={updating}
                            style={{
                              marginTop: 12, padding: '10px 24px', borderRadius: 8,
                              background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 13,
                              border: 'none', cursor: 'pointer', opacity: updating ? 0.7 : 1,
                            }}
                          >
                            {updating ? '...' : 'Mark as Refunded'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
