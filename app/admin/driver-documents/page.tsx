'use client'

import { useState, useEffect } from 'react'

interface DriverDocument {
  id: string
  driver_id: string
  doc_type: string
  file_url: string
  file_name: string
  status: string
  admin_notes: string | null
  expires_at: string | null
  uploaded_at: string
  reviewed_at: string | null
  driver: { name: string; email: string; phone: string | null }
}

const DOC_LABELS: Record<string, string> = {
  selfie: 'Selfie Photo',
  w9: 'W-9 Form',
  drivers_license: "Driver's License (Front)",
  drivers_license_back: "Driver's License (Back)",
  insurance: 'Vehicle Insurance',
  vehicle_registration: 'Vehicle Registration',
  contractor_agreement: 'Contractor Agreement',
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  rejected: { bg: '#FEE2E2', color: '#DC2626' },
}

export default function AdminDriverDocuments() {
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [actionDoc, setActionDoc] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set())

  const toggleDriver = (id: string) =>
    setExpandedDrivers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const fetchDocs = () => {
    fetch('/api/admin/driver-documents')
      .then(r => r.json())
      .then(d => {
        const docs: DriverDocument[] = d.documents || []
        setDocuments(docs)
        // Auto-expand drivers that have any pending or rejected docs — those need
        // admin attention. Approved drivers stay collapsed for a clean view.
        const needsAttention = new Set(
          docs.filter(doc => doc.status === 'pending' || doc.status === 'rejected').map(doc => doc.driver_id)
        )
        setExpandedDrivers(prev => new Set([...prev, ...needsAttention]))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [])

  const [driverStatuses, setDriverStatuses] = useState<Record<string, string>>({})

  // Fetch driver statuses
  useEffect(() => {
    fetch('/api/admin/drivers')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, string> = {}
        ;(d.drivers || []).forEach((drv: any) => { map[drv.id] = drv.driver_status || 'pending_documents' })
        setDriverStatuses(map)
      })
      .catch(() => {})
  }, [])

  const handleAction = async (docId: string, status: 'approved' | 'rejected') => {
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/driver-documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, status, admin_notes: adminNotes || undefined }),
      })
      if (res.ok) {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status, admin_notes: adminNotes || d.admin_notes, reviewed_at: new Date().toISOString() } : d))
        setActionDoc(null)
        setAdminNotes('')
        // Refresh driver statuses
        fetch('/api/admin/drivers').then(r => r.json()).then(d => {
          const map: Record<string, string> = {}
          ;(d.drivers || []).forEach((drv: any) => { map[drv.id] = drv.driver_status || 'pending_documents' })
          setDriverStatuses(map)
        }).catch(() => {})
      }
    } catch {}
    finally { setProcessing(false) }
  }

  const approveDriver = async (driverId: string) => {
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, driver_status: 'approved' }),
      })
      if (res.ok) {
        setDriverStatuses(prev => ({ ...prev, [driverId]: 'approved' }))
      }
    } catch {}
    finally { setProcessing(false) }
  }

  const filtered = filter === 'all' ? documents : documents.filter(d => d.status === filter)
  const pendingCount = documents.filter(d => d.status === 'pending').length

  // Group by driver
  const driverMap = new Map<string, { driver: DriverDocument['driver']; docs: DriverDocument[] }>()
  filtered.forEach(doc => {
    const existing = driverMap.get(doc.driver_id)
    if (existing) {
      existing.docs.push(doc)
    } else {
      driverMap.set(doc.driver_id, { driver: doc.driver, docs: [doc] })
    }
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading documents...</div>

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 120px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>{documents.length}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Total Documents</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 120px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B' }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Pending Review</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 120px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{documents.filter(d => d.status === 'approved').length}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Approved</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 120px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#EF4444' }}>{documents.filter(d => d.status === 'rejected').length}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Rejected</div>
        </div>
      </div>

      {/* Filter + expand controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: filter === f ? '#6366F1' : '#F3F4F6',
            color: filter === f ? '#fff' : '#6B7280',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setExpandedDrivers(new Set(Array.from(driverMap.keys())))}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}
          >
            Expand all
          </button>
          <button
            onClick={() => setExpandedDrivers(new Set())}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Documents grouped by driver */}
      {driverMap.size === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          No documents found
        </div>
      ) : (
        Array.from(driverMap.entries()).map(([driverId, { driver, docs }]) => {
          const isExpanded = expandedDrivers.has(driverId)
          const approvedCount = docs.filter(d => d.status === 'approved').length
          const driverStatus = driverStatuses[driverId]
          return (
          <div key={driverId} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16, overflow: 'hidden' }}>
            {/* Driver header — clickable to expand/collapse */}
            <div
              onClick={() => toggleDriver(driverId)}
              style={{
                padding: '14px 20px',
                borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                background: '#FAFAFA',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FAFAFA')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, color: '#9CA3AF', width: 14, transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span style={{ fontWeight: 800, fontSize: 19, color: '#6366F1', letterSpacing: 0.2 }}>{driver.name}</span>
                <span style={{ fontSize: 13, color: '#6B7280' }}>{driver.email}</span>
                {driver.phone && <span style={{ fontSize: 13, color: '#6B7280' }}>{driver.phone}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{approvedCount}/7 approved</span>
                {driverStatus === 'approved' ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#D1FAE5', color: '#065F46' }}>
                    Driver Approved
                  </span>
                ) : driverStatus === 'pending_approval' ? (
                  <button
                    onClick={() => approveDriver(driverId)}
                    disabled={processing}
                    style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Approve Driver
                  </button>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#FEF3C7', color: '#92400E' }}>
                    Pending Documents
                  </span>
                )}
              </div>
            </div>

            {/* Documents — only render when expanded */}
            {isExpanded && docs.map(doc => (
              <div key={doc.id} style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{DOC_LABELS[doc.doc_type] || doc.doc_type}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: STATUS_STYLES[doc.status]?.bg, color: STATUS_STYLES[doc.status]?.color,
                    }}>
                      {doc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {doc.file_name} — Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                    {doc.reviewed_at && ` — Reviewed ${new Date(doc.reviewed_at).toLocaleDateString()}`}
                  </div>
                  {doc.admin_notes && (
                    <div style={{ fontSize: 12, color: '#DC2626', marginTop: 2, fontStyle: 'italic' }}>Note: {doc.admin_notes}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
                    View File
                  </a>

                  {actionDoc === doc.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={adminNotes}
                        onChange={e => setAdminNotes(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, width: 160 }}
                      />
                      <button
                        onClick={() => handleAction(doc.id, 'approved')}
                        disabled={processing}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(doc.id, 'rejected')}
                        disabled={processing}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => { setActionDoc(null); setAdminNotes('') }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActionDoc(doc.id)}
                      style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#374151', fontWeight: 600 }}
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )
        })
      )}
    </div>
  )
}
