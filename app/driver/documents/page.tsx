'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SelfieCaptureModal from '@/components/SelfieCaptureModal'
import { compressImage } from '@/lib/compress-image'

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
  { key: 'drivers_license', label: "Driver's License (Front)", description: 'Front of your government-issued ID', icon: '🪪' },
  { key: 'drivers_license_back', label: "Driver's License (Back)", description: 'Back of your government-issued ID', icon: '🪪' },
  { key: 'w9', label: 'W-9 Form', description: 'IRS tax form (required for 1099)', icon: '📄', downloadUrl: '/driver/documents/w9', downloadLabel: 'Fill out W-9 online', isInternal: true },
  { key: 'insurance', label: 'Vehicle Insurance', description: 'Proof of active auto insurance', icon: '🛡️' },
  { key: 'vehicle_registration', label: 'Vehicle Registration', description: 'Current vehicle registration', icon: '🚗' },
  { key: 'contractor_agreement', label: 'Contractor Agreement', description: 'Sign the independent contractor agreement', icon: '📝', downloadUrl: '/driver/sign-agreement', downloadLabel: 'Sign agreement' },
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
  const router = useRouter()

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
      // Combine all 3 selfie photos into one side-by-side image
      const images = await Promise.all(photos.map(f => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.src = URL.createObjectURL(f)
        })
      }))

      const canvas = document.createElement('canvas')
      const gap = 4
      canvas.width = images.reduce((w, img) => w + img.width, 0) + gap * (images.length - 1)
      canvas.height = Math.max(...images.map(img => img.height))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#1A1A2E'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      let x = 0
      // Add labels
      const labels = ['CENTER', 'LEFT', 'RIGHT']
      images.forEach((img, i) => {
        ctx.drawImage(img, x, 0)
        // Label at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(x, img.height - 28, img.width, 28)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(labels[i], x + img.width / 2, img.height - 10)
        x += img.width + gap
      })

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.9)
      })
      const combinedFile = new File([blob], `selfie-combined-${Date.now()}.jpg`, { type: 'image/jpeg' })

      // Upload single combined image
      const formData = new FormData()
      formData.append('file', combinedFile)
      formData.append('doc_type', 'selfie')

      const res = await fetch('/api/driver/documents', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setDocuments(prev => {
          const filtered = prev.filter(d => d.doc_type !== 'selfie')
          return [data.document, ...filtered]
        })
        setSuccess('Selfie verification uploaded! (3 angles: center, left, right)')
        setTimeout(() => setSuccess(''), 4000)

        // Also use the center pose (photos[0]) as the driver's profile avatar so
        // it shows up on customer tracking, shop orders, and admin views right away.
        // We only set it if the driver doesn't already have a custom avatar — never
        // overwrite a photo they uploaded themselves via /driver/settings.
        ;(async () => {
          try {
            const meRes = await fetch('/api/driver/settings').then(r => r.ok ? r.json() : null)
            if (meRes && !meRes.avatar_url && photos[0]) {
              const avatarForm = new FormData()
              avatarForm.append('file', photos[0])
              avatarForm.append('type', 'avatar')
              const upRes = await fetch('/api/upload', { method: 'POST', body: avatarForm })
              const upData = await upRes.json()
              if (upRes.ok && upData.url) {
                await fetch('/api/driver/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ avatar_url: upData.url }),
                })
              }
            }
          } catch { /* non-blocking — selfie verification still succeeded */ }
        })()
      } else {
        setError(data.error || 'Upload failed')
      }

      // Cleanup
      images.forEach(img => URL.revokeObjectURL(img.src))
    } catch {
      setError('Selfie upload failed')
    } finally {
      setUploading(null)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0]
    if (!original || !uploadDocType) return

    setUploading(uploadDocType)
    setError('')
    setSuccess('')

    // Compress images before upload — high-res phone photos can OOM mobile
    // browsers (10–25MB PNG/JPEG). PDFs and small files pass through.
    const file = await compressImage(original, 2000, 0.85)

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
                        {(docType as any).isInternal ? (
                          <button onClick={() => router.push((docType as any).downloadUrl)} style={{
                            background: 'none', border: 'none', color: '#FF8C00', fontWeight: 600,
                            fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                          }}>
                            {(docType as any).downloadLabel}
                          </button>
                        ) : (
                          <a href={(docType as any).downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FF8C00', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                            ↓ {(docType as any).downloadLabel}
                          </a>
                        )}
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
          Please review the full agreement between you and DonutDash Technologies LLC.
        </div>
      </div>
    </div>
  )
}
