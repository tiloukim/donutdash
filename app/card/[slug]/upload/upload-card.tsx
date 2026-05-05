'use client'

import { useRef, useState } from 'react'
import AvatarCropper from '@/components/AvatarCropper'

interface Props {
  slug: string
  name: string
  title: string
  currentPhoto: string | null
  token: string
}

export default function UploadCard({ slug, name, title, currentPhoto, token }: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<string | null>(currentPhoto)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCropped = async (blob: Blob) => {
    setPendingFile(null)
    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      const res = await fetch(`/api/team/photo?slug=${encodeURIComponent(slug)}&t=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || `Upload failed (${res.status})`)
      } else {
        setPhoto(data.url)
        setDone(true)
      }
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    }
    setUploading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 12px 48px rgba(255, 20, 147, 0.12)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>DonutDash Team</div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>{name}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#FF1493', fontWeight: 600 }}>{title}</p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 144, height: 144, borderRadius: '50%',
            background: photo
              ? `url(${photo}) center/cover`
              : 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 48, fontWeight: 800,
            border: '4px solid #fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            {!photo && name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              setError('')
              setDone(false)
              setPendingFile(f)
            }
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #FF1493, #FF8C00)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          {uploading ? 'Uploading...' : photo ? '📷 Replace Photo' : '📷 Upload Your Photo'}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: 10, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        {done && !error && (
          <div style={{ marginTop: 12, padding: 10, background: '#F0FDF4', color: '#065F46', borderRadius: 8, fontSize: 13 }}>
            Saved! <a href={`/card/${slug}`} style={{ color: '#065F46', fontWeight: 700 }}>View your card →</a>
          </div>
        )}

        <p style={{ margin: '20px 0 0', fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
          This link only updates your photo. Pick a clear, well-lit shot of your face — it&apos;ll show on your DonutDash business card.
        </p>
      </div>

      {pendingFile && (
        <AvatarCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onCrop={handleCropped}
        />
      )}
    </div>
  )
}
