'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import type { Shop } from '@/lib/types'

type Relationship = 'owner' | 'manager' | 'employee'

type DocSlot = 'business_license' | 'utility_bill' | 'health_permit' | 'additional_docs'

const DOC_LABELS: Record<DocSlot, string> = {
  business_license: 'Business License',
  utility_bill: 'Utility Bill (proof of address)',
  health_permit: 'Health / Food Permit',
  additional_docs: 'Additional Documents (optional)',
}

export default function ClaimShopPage() {
  const params = useParams()
  const slug = params.slug as string
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Form state
  const [relationship, setRelationship] = useState<Relationship>('owner')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [certify, setCertify] = useState(false)

  const [docUrls, setDocUrls] = useState<Record<DocSlot, string>>({
    business_license: '',
    utility_bill: '',
    health_permit: '',
    additional_docs: '',
  })
  const [uploadingSlot, setUploadingSlot] = useState<DocSlot | null>(null)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`/api/shops?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        const found: Shop | undefined = (data.shops || [])[0]
        if (!found) {
          setNotFound(true)
          return
        }
        setShop(found)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleUpload(slot: DocSlot, file: File) {
    setUploadError('')
    setUploadingSlot(slot)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'claim-doc')
      const res = await fetch('/api/shop/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed')
        return
      }
      setDocUrls(prev => ({ ...prev, [slot]: data.url }))
    } catch {
      setUploadError('Upload failed')
    } finally {
      setUploadingSlot(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shop) return
    setError('')

    if (!certify) {
      setError('Please certify that you are authorized to manage this shop.')
      return
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.')
      return
    }
    if (!docUrls.business_license && !docUrls.utility_bill && !docUrls.health_permit) {
      setError('Please upload at least one verification document.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/shop/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          relationship,
          phone: phone.trim(),
          business_license_url: docUrls.business_license || null,
          utility_bill_url: docUrls.utility_bill || null,
          health_permit_url: docUrls.health_permit || null,
          additional_docs_url: docUrls.additional_docs || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit claim request')
        return
      }
      setSuccess(true)
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div className="desktop-only"><Navbar /></div>
        <main style={{ flex: 1, padding: '2rem', textAlign: 'center', color: '#999' }}>
          Loading shop...
        </main>
      </div>
    )
  }

  if (notFound || !shop) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div className="desktop-only"><Navbar /></div>
        <main style={{ flex: 1, padding: '3rem 1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A2E' }}>Shop not found</h1>
          <p style={{ color: '#888', marginTop: '0.5rem' }}>
            We couldn&apos;t find that shop.
          </p>
          <Link
            href="/shops"
            style={{ color: '#FF1493', fontWeight: 600, display: 'inline-block', marginTop: '1rem' }}
          >
            &larr; Back to shops
          </Link>
        </main>
      </div>
    )
  }

  const alreadyClaimed = shop.is_claimed !== false

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="desktop-only"><Navbar /></div>

      <main style={{ flex: 1, paddingBottom: '80px' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', padding: '20px 16px' }}>
          <Link
            href="/shops"
            style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}
          >
            &larr; Back to shops
          </Link>

          {/* Shop header */}
          <div style={{
            marginTop: '16px',
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0',
          }}>
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              background: shop.image_url
                ? `url(${shop.image_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #FF69B4, #FF1493)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              {!shop.image_url && <span style={{ fontSize: '3rem' }}>🍩</span>}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(255,255,255,0.95)',
                border: '1.5px solid #FF1493',
                color: '#FF1493',
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '12px',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}>
                Unclaimed
              </div>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <h1 style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#1A1A2E',
                margin: 0,
              }}>
                {shop.name}
              </h1>
              <p style={{
                color: '#666',
                fontSize: '13px',
                margin: '6px 0 0',
                lineHeight: 1.5,
              }}>
                {shop.address}
                {shop.city ? `, ${shop.city}` : ''}
                {shop.state ? `, ${shop.state}` : ''}
                {shop.zip ? ` ${shop.zip}` : ''}
              </p>
              {shop.phone && (
                <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0' }}>
                  {shop.phone}
                </p>
              )}
            </div>
          </div>

          {/* Already claimed */}
          {alreadyClaimed && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#F0FFF4',
              border: '1px solid #9AE6B4',
              borderRadius: '12px',
              color: '#22543D',
              fontSize: '14px',
            }}>
              This shop has already been claimed.{' '}
              <Link href={`/shops/${shop.slug}`} style={{ color: '#FF1493', fontWeight: 600 }}>
                View shop
              </Link>
            </div>
          )}

          {/* Not signed in */}
          {!alreadyClaimed && !user && (
            <>
              <div style={{
                marginTop: '20px',
                padding: '16px 18px',
                background: '#FFF0F5',
                border: '1px solid #FFD6E7',
                borderRadius: '12px',
              }}>
                <h2 style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#1A1A2E',
                  margin: 0,
                }}>
                  Are you the owner?
                </h2>
                <p style={{
                  color: '#555',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  margin: '8px 0 0',
                }}>
                  Claim this shop to manage orders, menu, and payouts on DonutDash. Sign in or create an
                  account to continue. We&apos;ll ask for documents to verify you&apos;re authorized.
                </p>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  href={`/signup?role=shop_owner&claim=${shop.id}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.95rem',
                    background: '#FF1493',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  Sign up as owner
                </Link>
                <Link
                  href={`/login?claim=${shop.id}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.95rem',
                    background: 'white',
                    color: '#FF1493',
                    border: '1.5px solid #FF1493',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </>
          )}

          {/* Success state */}
          {!alreadyClaimed && user && success && (
            <div style={{
              marginTop: '20px',
              padding: '22px 20px',
              background: '#F0FFF4',
              border: '1px solid #9AE6B4',
              borderRadius: '12px',
              color: '#22543D',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                Claim submitted!
              </h2>
              <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.6 }}>
                We&apos;ll review your documents and email you within 24-48 hours.
                You can check back on this page for status updates.
              </p>
              <Link
                href="/shops"
                style={{
                  display: 'inline-block',
                  marginTop: '14px',
                  padding: '10px 18px',
                  background: '#FF1493',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Browse shops
              </Link>
            </div>
          )}

          {/* Claim form */}
          {!alreadyClaimed && user && !success && (
            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              {/* Info box */}
              <div style={{
                padding: '14px 16px',
                background: '#FFF0F5',
                border: '1px solid #FFD6E7',
                borderRadius: '12px',
                marginBottom: '20px',
              }}>
                <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                  To prevent fraudulent claims, we manually review ownership documents.
                  Upload at least one document (business license, utility bill, or health permit).
                  We&apos;ll email you within 24-48 hours.
                </p>
              </div>

              {/* Relationship */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1A1A2E', marginBottom: '8px' }}>
                  Your relationship to this shop
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['owner', 'manager', 'employee'] as Relationship[]).map(r => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: relationship === r ? '1.5px solid #FF1493' : '1px solid #E5E7EB',
                        borderRadius: '10px',
                        background: relationship === r ? '#FFF0F5' : 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1A1A2E',
                      }}
                    >
                      <input
                        type="radio"
                        name="relationship"
                        value={r}
                        checked={relationship === r}
                        onChange={() => setRelationship(r)}
                        style={{ accentColor: '#FF1493' }}
                      />
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1A1A2E', marginBottom: '8px' }}>
                  Phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    color: '#1A1A2E',
                    background: 'white',
                  }}
                />
              </div>

              {/* Document uploads */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1A1A2E', marginBottom: '8px' }}>
                  Verification documents
                </label>
                <p style={{ color: '#888', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Upload at least one. JPEG, PNG, WebP — max 5MB each.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(Object.keys(DOC_LABELS) as DocSlot[]).map(slot => {
                    const uploaded = !!docUrls[slot]
                    const uploading = uploadingSlot === slot
                    return (
                      <div
                        key={slot}
                        style={{
                          padding: '12px 14px',
                          border: uploaded ? '1.5px solid #9AE6B4' : '1px solid #E5E7EB',
                          borderRadius: '10px',
                          background: uploaded ? '#F0FFF4' : 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A2E' }}>
                            {DOC_LABELS[slot]}
                          </span>
                          {uploaded && (
                            <span style={{ fontSize: '11px', color: '#22543D', fontWeight: 700 }}>
                              Uploaded
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <label
                            style={{
                              display: 'inline-block',
                              padding: '7px 14px',
                              background: uploaded ? '#fff' : '#FF1493',
                              color: uploaded ? '#FF1493' : '#fff',
                              border: uploaded ? '1px solid #FF1493' : 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: uploading ? 'not-allowed' : 'pointer',
                              opacity: uploading ? 0.6 : 1,
                            }}
                          >
                            {uploading ? 'Uploading...' : uploaded ? 'Replace' : 'Choose file'}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploading}
                              style={{ display: 'none' }}
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) handleUpload(slot, f)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {uploaded && (
                            <a
                              href={docUrls[slot]}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '12px', color: '#FF1493', fontWeight: 600, textDecoration: 'none' }}
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {uploadError && (
                  <div style={{
                    marginTop: '10px',
                    background: '#F8D7DA',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#721C24',
                  }}>
                    {uploadError}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1A1A2E', marginBottom: '8px' }}>
                  Additional notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything else we should know?"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    color: '#1A1A2E',
                    background: 'white',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Certification */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  background: 'white',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                <input
                  type="checkbox"
                  checked={certify}
                  onChange={e => setCertify(e.target.checked)}
                  style={{ accentColor: '#FF1493', marginTop: '2px' }}
                />
                <span style={{ fontSize: '13px', color: '#1A1A2E', lineHeight: 1.5 }}>
                  I certify that I am authorized to manage this shop and that the information and
                  documents I&apos;ve provided are accurate.
                </span>
              </label>

              {error && (
                <div style={{
                  marginBottom: '16px',
                  background: '#F8D7DA',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  color: '#721C24',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.95rem',
                  background: submitting ? '#ccc' : '#FF1493',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#FF69B4' }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#FF1493' }}
              >
                {submitting ? 'Submitting...' : 'Submit claim request'}
              </button>

              <p style={{ color: '#aaa', fontSize: '11px', textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
                By submitting, you confirm you are authorized to represent this business.
                We&apos;ll review and email you within 24-48 hours.
              </p>
            </form>
          )}
        </div>
      </main>

      <style>{`
        .desktop-only { display: block; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
        }
      `}</style>

      <div className="desktop-only"><Footer /></div>
      <MobileBottomNav />
    </div>
  )
}
