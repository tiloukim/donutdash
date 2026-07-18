'use client'

import { useState, useEffect } from 'react'
import SignaturePad from '@/components/SignaturePad'

export default function SignAgreementPage() {
  const [fullName, setFullName] = useState('')
  const [date] = useState(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check if already signed
  useEffect(() => {
    fetch('/api/driver/documents')
      .then(r => r.json())
      .then(d => {
        const docs = d.documents || []
        const agreement = docs.find((doc: any) => doc.doc_type === 'contractor_agreement')
        if (agreement) setAlreadySigned(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError('Please enter your full legal name.'); return }
    if (!signatureDataUrl) { setError('Please sign the agreement.'); return }
    if (!agreed) { setError('Please check the agreement checkbox.'); return }

    setSubmitting(true)
    setError('')

    try {
      // Convert signature data URL to file
      const res = await fetch(signatureDataUrl)
      const blob = await res.blob()

      // Create a combined PDF-like image with name + date + signature
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 200
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 800, 200)

      // Header
      ctx.fillStyle = '#FF8C00'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText('INDEPENDENT CONTRACTOR AGREEMENT — SIGNATURE PAGE', 20, 25)

      // Separator
      ctx.strokeStyle = '#eee'
      ctx.beginPath()
      ctx.moveTo(20, 35)
      ctx.lineTo(780, 35)
      ctx.stroke()

      // Name + Date
      ctx.fillStyle = '#1A1A2E'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText(`Contractor: ${fullName.trim()}`, 20, 60)
      ctx.font = '14px sans-serif'
      ctx.fillText(`Date: ${date}`, 20, 82)
      ctx.fillText('Company: DonutDash Technologies LLC', 400, 60)
      ctx.fillText('Tyler, Texas', 400, 82)

      // Draw signature
      const sigImg = new Image()
      await new Promise<void>((resolve) => {
        sigImg.onload = () => resolve()
        sigImg.src = signatureDataUrl
      })
      ctx.drawImage(sigImg, 20, 90, 350, 100)

      // "Electronically signed" label
      ctx.fillStyle = '#888'
      ctx.font = '11px sans-serif'
      ctx.fillText(`Electronically signed on ${date} via DonutDash`, 20, 195)

      const combinedBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png')
      })

      const file = new File([combinedBlob], `contractor-agreement-signed-${Date.now()}.png`, { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', 'contractor_agreement')

      const uploadRes = await fetch('/api/driver/documents', {
        method: 'POST',
        body: formData,
      })
      const data = await uploadRes.json()
      if (uploadRes.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'Failed to submit agreement')
      }
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ color: '#FF8C00', fontWeight: 600 }}>Loading...</div>
    </div>
  )

  if (success || alreadySigned) return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>✅</span>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
        {alreadySigned ? 'Agreement Already Signed' : 'Agreement Signed Successfully!'}
      </h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        {alreadySigned
          ? 'You have already signed the Independent Contractor Agreement. You can view it in your Documents.'
          : 'Your signed agreement has been submitted. You can view it in your Documents.'
        }
      </p>
    </div>
  )

  const ORANGE = '#FF8C00'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>
        Independent Contractor Agreement
      </h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        Please read the agreement below and sign at the bottom
      </p>

      {/* Agreement content in scrollable box */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: 24, maxHeight: 400, overflowY: 'auto', marginBottom: 20,
        fontSize: 14, lineHeight: 1.8, color: '#333',
      }}>
        <h3 style={{ color: ORANGE, fontSize: 16, marginTop: 0 }}>1. Parties</h3>
        <p>This Independent Contractor Agreement (&quot;Agreement&quot;) is entered into between <strong>DonutDash Technologies LLC</strong> (&quot;Company&quot;), a Texas limited liability company with its principal place of business in Tyler, Texas, and the individual who accepts this Agreement through the DonutDash platform (&quot;Contractor&quot; or &quot;Driver&quot;).</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>2. Independent Contractor Status</h3>
        <p>Contractor is an independent contractor and is <strong>not</strong> an employee, agent, partner, or joint venturer of the Company. Contractor retains full control over when, where, and how they perform delivery services.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>3. Services</h3>
        <p>Contractor agrees to provide delivery services for food orders placed through the DonutDash platform. Contractor may accept or decline any delivery assignment at their sole discretion.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>4. Compensation</h3>
        <p>Contractor will be compensated per delivery based on distance, order size, and any applicable surge pricing. Tips from customers are 100% retained by the Contractor. Payouts are processed weekly via ACH or other agreed-upon methods.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>5. Expenses &amp; Equipment</h3>
        <p>Contractor is responsible for all expenses related to their delivery services, including vehicle maintenance, fuel, insurance, and mobile phone costs. The Company does not provide equipment or reimburse expenses.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>6. Insurance &amp; Compliance</h3>
        <p>Contractor must maintain valid auto insurance, a valid driver&apos;s license, and comply with all applicable federal, state, and local laws. Contractor is responsible for all applicable taxes including self-employment tax.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>7. Termination</h3>
        <p>Either party may terminate this Agreement at any time, for any reason, with or without notice. Contractor may stop accepting deliveries at any time. The Company may deactivate Contractor&apos;s account for violation of platform policies.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>8. Confidentiality</h3>
        <p>Contractor agrees to keep confidential all customer information, delivery details, and proprietary business information obtained through the DonutDash platform.</p>

        <h3 style={{ color: ORANGE, fontSize: 16 }}>9. Governing Law</h3>
        <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Texas. Any disputes shall be resolved in the courts of Smith County, Texas.</p>
      </div>

      {/* Signature section */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 16, marginTop: 0 }}>
          Sign Agreement
        </h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#1A1A2E' }}>
            Full Legal Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="John Doe"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid #ddd', fontSize: 15, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#1A1A2E' }}>
            Date
          </label>
          <div style={{
            padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd',
            fontSize: 15, color: '#666', background: '#f9f9f9',
          }}>
            {date}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1A1A2E' }}>
            Signature {signatureDataUrl && <span style={{ color: '#10B981', fontWeight: 400 }}>✓ Signed</span>}
          </label>
          <SignaturePad onSave={setSignatureDataUrl} width={500} height={180} />
        </div>

        {signatureDataUrl && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 3, accentColor: ORANGE, width: 18, height: 18 }}
            />
            <label htmlFor="agree" style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
              I, <strong>{fullName || '___'}</strong>, have read and agree to the terms of the Independent Contractor Agreement. I understand that I am signing this agreement electronically and that my electronic signature has the same legal effect as a handwritten signature.
            </label>
          </div>
        )}

        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: '#DC2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !signatureDataUrl || !agreed || !fullName.trim()}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: submitting || !signatureDataUrl || !agreed || !fullName.trim() ? '#ccc' : ORANGE,
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Signed Agreement'}
        </button>
      </div>
    </div>
  )
}
