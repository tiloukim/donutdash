'use client'

import { useState, useEffect, useRef } from 'react'
import SelfieCaptureModal from '@/components/SelfieCaptureModal'

interface DriverDocument {
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
  { key: 'selfie', label: 'Selfie Photo', description: 'Clear photo of your face for identity verification', icon: '🤳' },
  { key: 'drivers_license', label: "Driver's License", description: 'Valid government-issued ID', icon: '🪪' },
  { key: 'w9', label: 'W-9 Form', description: 'IRS tax form (required for 1099)', icon: '📄', downloadUrl: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', downloadLabel: 'Download blank W-9' },
  { key: 'insurance', label: 'Vehicle Insurance', description: 'Proof of active auto insurance', icon: '🛡️' },
  { key: 'vehicle_registration', label: 'Vehicle Registration', description: 'Current vehicle registration', icon: '🚗' },
  { key: 'contractor_agreement', label: 'Contractor Agreement', description: 'Independent contractor agreement', icon: '📝', downloadUrl: '/contractor-agreement', downloadLabel: 'View agreement' },
]

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E', label: 'Under Review' },
  approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
  rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
}

export default function DriverDocuments() {
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState<string | null>(null)
  const [showSelfieModal, setShowSelfieModal] = useState(false)

  useEffect(() => {
    fetch('/api/driver/documents')
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
    if (docType === 'selfie') {
      setShowSelfieModal(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSelfieComplete = async (photos: File[]) => {
    setShowSelfieModal(false)
    if (photos.length === 0) return

    setUploading('selfie')
    setError('')
    setSuccess('')

    try {
      // Upload all 3 selfie photos as a single combined image
      // We'll upload the first (front-facing) as the main selfie doc
      // and include all 3 in a single upload
      for (let i = 0; i < photos.length; i++) {
        const formData = new FormData()
        formData.append('file', photos[i])
        // First photo is 'selfie', additional ones are 'selfie' with index suffix
        formData.append('doc_type', i === 0 ? 'selfie' : `selfie`)

        const res = await fetch('/api/driver/documents', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (res.ok && i === 0) {
          // Update UI with the front-facing selfie
          setDocuments(prev => {
            const filtered = prev.filter(d => d.doc_type !== 'selfie')
            return [data.document, ...filtered]
          })
        }
      }
      setSuccess('Selfie verification photos uploaded successfully! (3 angles captured)')
      setTimeout(() => setSuccess(''), 4000)
    } catch {
      setError('Selfie upload failed')
    } finally {
      setUploading(null)
    }
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
      const res = await fetch('/api/driver/documents', {
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
      if (selfieInputRef.current) selfieInputRef.current.value = ''
    }
  }

  const completedCount = documents.filter(d => d.status === 'approved').length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ color: '#FF8C00', fontWeight: 600 }}>Loading documents...</div>
    </div>
  )

  return (
    <div>
      {/* Selfie capture modal */}
      {showSelfieModal && (
        <SelfieCaptureModal
          onComplete={handleSelfieComplete}
          onClose={() => setShowSelfieModal(false)}
        />
      )}

      {/* Progress bar */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Onboarding Progress</h3>
          <span style={{ fontSize: 14, fontWeight: 700, color: completedCount === DOC_TYPES.length ? '#10B981' : '#FF8C00' }}>
            {completedCount}/{DOC_TYPES.length} Approved
          </span>
        </div>
        <div style={{ background: '#F3F4F6', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{
            background: completedCount === DOC_TYPES.length ? '#10B981' : '#FF8C00',
            height: '100%',
            width: `${(completedCount / DOC_TYPES.length) * 100}%`,
            borderRadius: 8,
            transition: 'width 0.3s',
          }} />
        </div>
        {completedCount === DOC_TYPES.length && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#10B981', fontWeight: 600 }}>
            All documents approved! You are fully onboarded.
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
      {/* Selfie input — camera only, no file picker */}
      <input
        ref={selfieInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Document cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DOC_TYPES.map(docType => {
          const doc = getDocStatus(docType.key)
          const isUploading = uploading === docType.key
          const status = doc ? statusStyles[doc.status] : null

          return (
            <div key={docType.key} style={{
              background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', padding: 20,
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
                        <a href={(docType as any).downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FF8C00', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
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
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff',
                        fontSize: 13, color: '#666', textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      View
                    </a>
                  )}
                  <button
                    onClick={() => handleUploadClick(docType.key)}
                    disabled={isUploading}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: doc ? '#FF8C00' : '#10B981', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {isUploading ? 'Uploading...' : doc ? 'Re-upload' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 20, padding: 16, background: '#FFF8F0', borderRadius: 10, border: '1px solid #FFE8D6' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>Accepted formats</div>
        <div style={{ fontSize: 12, color: '#888' }}>JPEG, PNG, WebP, or PDF — Max 10MB per file</div>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #FFE8D6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <a
            href="/contractor-agreement"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, fontWeight: 600, color: '#FF8C00', textDecoration: 'underline' }}
          >
            Review the Independent Contractor Agreement
          </a>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 26 }}>
          Please review the full agreement between you and KIMCO LLC DBA DonutDash.
        </div>
      </div>
    </div>
  )
}
