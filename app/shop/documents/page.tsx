'use client'

import { useState, useEffect, useRef } from 'react'

interface ShopDocument {
  id: string
  doc_type: string
  file_url: string
  file_name: string
  status: string
  admin_notes: string | null
  expires_at: string | null
  uploaded_at: string
  reviewed_at: string | null
}

const DOC_TYPES = [
  { key: 'w9', label: 'W-9 Form', description: 'IRS tax form (required for 1099)', icon: '📄', required: true, downloadUrl: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', downloadLabel: 'Download blank W-9' },
  { key: 'business_license', label: 'Business License', description: 'Proof of legal business operation', icon: '🏛️', required: true },
  { key: 'health_permit', label: 'Health / Food Handler Permit', description: 'TX health department food handling permit', icon: '🏥', required: true, downloadUrl: 'https://www.dshs.texas.gov/food-handlers', downloadLabel: 'TX Food Handler info' },
  { key: 'insurance_certificate', label: 'Certificate of Insurance', description: 'General liability insurance', icon: '🛡️', required: true },
  { key: 'food_establishment_permit', label: 'Food Establishment Permit', description: 'TX DSHS food establishment permit', icon: '🍽️', required: false, downloadUrl: 'https://www.dshs.texas.gov/food-establishments', downloadLabel: 'TX DSHS info' },
  { key: 'sales_tax_permit', label: 'Sales Tax Permit', description: 'TX Comptroller sales tax permit', icon: '🧾', required: false, downloadUrl: 'https://comptroller.texas.gov/taxes/permit/', downloadLabel: 'Apply for permit' },
  { key: 'business_entity_docs', label: 'Business Entity Documents', description: 'LLC/Corp articles, DBA filing, or EIN letter', icon: '📁', required: false, downloadUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', downloadLabel: 'Apply for EIN' },
]

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FCE7F3', color: '#9D174D', label: 'Under Review' },
  approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
  rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
}

export default function ShopDocuments() {
  const [documents, setDocuments] = useState<ShopDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/shop/documents')
      .then(r => r.json())
      .then(d => setDocuments(d.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getDocStatus = (docType: string) => {
    return documents.find(d => d.doc_type === docType)
  }

  const handleUploadClick = (docType: string) => {
    setUploadDocType(docType)
    setError('')
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadDocType) return

    setUploading(uploadDocType)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', uploadDocType)

    try {
      const res = await fetch('/api/shop/documents', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setDocuments(prev => {
          const filtered = prev.filter(d => d.doc_type !== uploadDocType)
          return [data.document, ...filtered]
        })
        setSuccess(`${DOC_TYPES.find(d => d.key === uploadDocType)?.label} uploaded successfully!`)
        setTimeout(() => setSuccess(''), 4000)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(null)
      setUploadDocType(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const requiredDocs = DOC_TYPES.filter(d => d.required)
  const completedRequired = requiredDocs.filter(d => {
    const doc = getDocStatus(d.key)
    return doc && doc.status === 'approved'
  }).length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ color: '#FF1493', fontWeight: 600 }}>Loading documents...</div>
    </div>
  )

  return (
    <div>
      {/* Progress bar */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFD6EC', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Onboarding Progress</h3>
          <span style={{ fontSize: 14, fontWeight: 700, color: completedRequired === requiredDocs.length ? '#10B981' : '#FF1493' }}>
            {completedRequired}/{requiredDocs.length} Required Approved
          </span>
        </div>
        <div style={{ background: '#F3F4F6', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{
            background: completedRequired === requiredDocs.length ? '#10B981' : '#FF1493',
            height: '100%',
            width: `${(completedRequired / requiredDocs.length) * 100}%`,
            borderRadius: 8,
            transition: 'width 0.3s',
          }} />
        </div>
        {completedRequired === requiredDocs.length && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#10B981', fontWeight: 600 }}>
            All required documents approved! Your shop is fully compliant.
          </div>
        )}
      </div>

      {success && <div style={{ background: '#D1FAE5', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#065F46', fontSize: 14 }}>{success}</div>}
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#DC2626', fontSize: 14 }}>{error}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Required documents */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#9D174D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Required Documents</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {DOC_TYPES.filter(d => d.required).map(docType => {
          const doc = getDocStatus(docType.key)
          const isUploading = uploading === docType.key
          const status = doc ? statusStyles[doc.status] : null

          return (
            <div key={docType.key} style={{
              background: '#fff', borderRadius: 12, border: '1px solid #FFD6EC', padding: 20,
              opacity: isUploading ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{docType.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{docType.label}</span>
                    {status && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: status.bg, color: status.color,
                      }}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#888', marginLeft: 28 }}>
                    {docType.description}
                    {(docType as any).downloadUrl && (
                      <span style={{ marginLeft: 8 }}>
                        <a href={(docType as any).downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FF1493', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                          ↓ {(docType as any).downloadLabel}
                        </a>
                      </span>
                    )}
                  </div>
                  {doc && (
                    <div style={{ marginLeft: 28, marginTop: 6 }}>
                      <div style={{ fontSize: 12, color: '#aaa' }}>
                        Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()} — {doc.file_name}
                      </div>
                      {doc.admin_notes && (
                        <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4, fontStyle: 'italic' }}>
                          Admin: {doc.admin_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {doc?.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, color: '#666', textDecoration: 'none' }}>
                      View
                    </a>
                  )}
                  <button onClick={() => handleUploadClick(docType.key)} disabled={isUploading}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: doc ? '#FF1493' : '#10B981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {isUploading ? 'Uploading...' : doc ? 'Re-upload' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Optional documents */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Optional Documents</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DOC_TYPES.filter(d => !d.required).map(docType => {
          const doc = getDocStatus(docType.key)
          const isUploading = uploading === docType.key
          const status = doc ? statusStyles[doc.status] : null

          return (
            <div key={docType.key} style={{
              background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20,
              opacity: isUploading ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{docType.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{docType.label}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, border: '1px solid #E5E7EB', padding: '1px 6px', borderRadius: 4 }}>OPTIONAL</span>
                    {status && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: status.bg, color: status.color,
                      }}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#888', marginLeft: 28 }}>
                    {docType.description}
                    {(docType as any).downloadUrl && (
                      <span style={{ marginLeft: 8 }}>
                        <a href={(docType as any).downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FF1493', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                          ↓ {(docType as any).downloadLabel}
                        </a>
                      </span>
                    )}
                  </div>
                  {doc && (
                    <div style={{ marginLeft: 28, marginTop: 6 }}>
                      <div style={{ fontSize: 12, color: '#aaa' }}>
                        Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()} — {doc.file_name}
                      </div>
                      {doc.admin_notes && (
                        <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4, fontStyle: 'italic' }}>
                          Admin: {doc.admin_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {doc?.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, color: '#666', textDecoration: 'none' }}>
                      View
                    </a>
                  )}
                  <button onClick={() => handleUploadClick(docType.key)} disabled={isUploading}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: doc ? '#FF1493' : '#10B981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {isUploading ? 'Uploading...' : doc ? 'Re-upload' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 20, padding: 16, background: '#FFF5F8', borderRadius: 10, border: '1px solid #FFD6EC' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9D174D', marginBottom: 6 }}>Accepted formats</div>
        <div style={{ fontSize: 12, color: '#888' }}>JPEG, PNG, WebP, or PDF — Max 10MB per file</div>
      </div>
    </div>
  )
}
