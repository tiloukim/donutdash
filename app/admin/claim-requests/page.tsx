'use client'

import { useEffect, useState } from 'react'

interface ClaimRequest {
  id: string
  shop_id: string
  requester_id: string
  requester_name: string | null
  requester_email: string | null
  requester_phone: string | null
  relationship: string | null
  business_license_url: string | null
  utility_bill_url: string | null
  health_permit_url: string | null
  additional_docs_url: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'denied'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  shop: {
    id: string
    name: string
    slug: string
    address: string
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
    image_url: string | null
    is_claimed: boolean | null
    owner_id: string | null
  } | null
  requester: {
    id: string
    name: string
    email: string
    phone: string | null
    role: string
  } | null
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  denied: { bg: '#FEE2E2', color: '#DC2626' },
}

const DOC_LABELS: Record<string, string> = {
  business_license_url: 'Business License',
  utility_bill_url: 'Utility Bill',
  health_permit_url: 'Health Permit',
  additional_docs_url: 'Additional Docs',
}

export default function AdminClaimRequestsPage() {
  const [requests, setRequests] = useState<ClaimRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending')
  const [actionId, setActionId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function load(status: typeof filter) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/claim-requests?status=${status}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load')
        setRequests([])
        return
      }
      setRequests(data.requests || [])
    } catch {
      setError('Failed to load')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filter)
  }, [filter])

  async function handleApprove(id: string) {
    if (!confirm('Approve this claim request and assign ownership?')) return
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/admin/claim-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to approve')
        return
      }
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch {
      setError('Failed to approve')
    } finally {
      setProcessing(false)
    }
  }

  async function handleDeny(id: string) {
    if (!denyReason.trim()) {
      setError('Please provide a reason for denial.')
      return
    }
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/admin/claim-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action: 'deny', admin_notes: denyReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to deny')
        return
      }
      setRequests(prev => prev.filter(r => r.id !== id))
      setActionId(null)
      setDenyReason('')
    } catch {
      setError('Failed to deny')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'denied', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: filter === f ? '#FF1493' : '#F3F4F6',
              color: filter === f ? '#fff' : '#6B7280',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading claim requests...</div>
      ) : requests.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #E5E7EB',
            padding: 40,
            textAlign: 'center',
            color: '#9CA3AF',
          }}
        >
          No {filter === 'all' ? '' : filter} claim requests
        </div>
      ) : (
        requests.map(r => {
          const docs: { key: string; url: string | null }[] = [
            { key: 'business_license_url', url: r.business_license_url },
            { key: 'utility_bill_url', url: r.utility_bill_url },
            { key: 'health_permit_url', url: r.health_permit_url },
            { key: 'additional_docs_url', url: r.additional_docs_url },
          ]
          const hasDocs = docs.some(d => d.url)

          return (
            <div
              key={r.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #E5E7EB',
                  background: '#FAFAFA',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>
                    {r.shop?.name || '(shop missing)'}
                  </span>
                  <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 12 }}>
                    {r.shop?.address}
                    {r.shop?.city ? `, ${r.shop.city}` : ''}
                    {r.shop?.state ? `, ${r.shop.state}` : ''}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: STATUS_STYLES[r.status]?.bg,
                    color: STATUS_STYLES[r.status]?.color,
                    textTransform: 'uppercase',
                  }}
                >
                  {r.status}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Requester
                    </div>
                    <div style={{ fontSize: 14, color: '#1A1A2E', fontWeight: 600 }}>
                      {r.requester?.name || r.requester_name || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {r.requester?.email || r.requester_email}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Phone
                    </div>
                    <div style={{ fontSize: 14, color: '#1A1A2E' }}>
                      {r.requester_phone || r.requester?.phone || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Relationship
                    </div>
                    <div style={{ fontSize: 14, color: '#1A1A2E', textTransform: 'capitalize' }}>
                      {r.relationship || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Submitted
                    </div>
                    <div style={{ fontSize: 14, color: '#1A1A2E' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Documents
                  </div>
                  {hasDocs ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {docs
                        .filter(d => d.url)
                        .map(d => (
                          <a
                            key={d.key}
                            href={d.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #E5E7EB',
                              fontSize: 12,
                              color: '#FF1493',
                              textDecoration: 'none',
                              fontWeight: 600,
                              background: '#FFF0F5',
                            }}
                          >
                            {DOC_LABELS[d.key]} →
                          </a>
                        ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
                      No documents uploaded
                    </div>
                  )}
                </div>

                {r.notes && (
                  <div
                    style={{
                      background: '#F9FAFB',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#374151',
                      marginBottom: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: '#1A1A2E' }}>Notes:</strong> {r.notes}
                  </div>
                )}

                {r.admin_notes && (
                  <div
                    style={{
                      background: '#FEF3C7',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#92400E',
                      marginBottom: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Admin notes:</strong> {r.admin_notes}
                  </div>
                )}

                {/* Actions */}
                {r.status === 'pending' && (
                  <>
                    {actionId === r.id ? (
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'stretch',
                          flexWrap: 'wrap',
                          background: '#FFF5F5',
                          border: '1px solid #FECACA',
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Reason for denial (required)"
                          value={denyReason}
                          onChange={e => setDenyReason(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 220,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #ddd',
                            fontSize: 13,
                          }}
                        />
                        <button
                          onClick={() => handleDeny(r.id)}
                          disabled={processing}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#EF4444',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: processing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Confirm deny
                        </button>
                        <button
                          onClick={() => {
                            setActionId(null)
                            setDenyReason('')
                            setError('')
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: '1px solid #ddd',
                            background: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#374151',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={processing}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#10B981',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: processing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActionId(r.id)
                            setDenyReason('')
                            setError('')
                          }}
                          disabled={processing}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: '1px solid #E5E7EB',
                            background: '#fff',
                            color: '#DC2626',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: processing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Deny
                        </button>
                        {r.shop?.slug && (
                          <a
                            href={`/shops/${r.shop.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '8px 18px',
                              borderRadius: 8,
                              border: '1px solid #E5E7EB',
                              background: '#fff',
                              color: '#374151',
                              fontSize: 13,
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-block',
                            }}
                          >
                            View shop
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}

                {r.status !== 'pending' && r.reviewed_at && (
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    Reviewed {new Date(r.reviewed_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
