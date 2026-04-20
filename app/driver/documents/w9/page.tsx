'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'

const TAX_CLASSIFICATIONS = [
  { key: 'individual', label: 'Individual/sole proprietor or single-member LLC' },
  { key: 'c_corp', label: 'C Corporation' },
  { key: 's_corp', label: 'S Corporation' },
  { key: 'partnership', label: 'Partnership' },
  { key: 'trust', label: 'Trust/estate' },
  { key: 'llc_c', label: 'LLC — C corporation' },
  { key: 'llc_s', label: 'LLC — S corporation' },
  { key: 'llc_p', label: 'LLC — Partnership' },
  { key: 'other', label: 'Other' },
]

export default function W9Form() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '',
    businessName: '',
    taxClassification: 'individual',
    otherClassification: '',
    exemptPayeeCode: '',
    exemptFatcaCode: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    accountNumbers: '',
    ssn1: '', ssn2: '', ssn3: '',
    ein1: '', ein2: '',
    taxIdType: 'ssn' as 'ssn' | 'ein',
  })

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#555',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #ddd', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  }
  const ssnInputStyle: React.CSSProperties = {
    ...inputStyle, textAlign: 'center', letterSpacing: 4, fontWeight: 700, fontSize: 16,
  }

  const isValid = () => {
    if (!form.name.trim()) return false
    if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) return false
    if (form.taxIdType === 'ssn') {
      if (!form.ssn1 || !form.ssn2 || !form.ssn3) return false
      if (form.ssn1.length !== 3 || form.ssn2.length !== 2 || form.ssn3.length !== 4) return false
    } else {
      if (!form.ein1 || !form.ein2) return false
      if (form.ein1.length !== 2 || form.ein2.length !== 7) return false
    }
    return true
  }

  const generatePDF = (): Blob => {
    const doc = new jsPDF('p', 'pt', 'letter')
    const w = doc.internal.pageSize.getWidth()
    const margin = 40
    let y = 40

    // Header
    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, w, 70, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Form W-9', margin, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Request for Taxpayer Identification Number and Certification', margin, 52)
    doc.setFontSize(8)
    doc.text('Department of the Treasury — Internal Revenue Service', margin, 64)

    y = 90

    // Section helper
    const section = (label: string, value: string) => {
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.setFont('helvetica', 'normal')
      doc.text(label, margin, y)
      y += 12
      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.text(value || '—', margin, y)
      y += 6
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, w - margin, y)
      y += 16
    }

    // Fields
    section('1. Name (as shown on your income tax return)', form.name)
    if (form.businessName) section('2. Business name / disregarded entity name', form.businessName)

    const classification = TAX_CLASSIFICATIONS.find(c => c.key === form.taxClassification)
    section('3. Federal tax classification', classification?.label || form.taxClassification)

    if (form.exemptPayeeCode) section('4. Exempt payee code', form.exemptPayeeCode)
    if (form.exemptFatcaCode) section('4. Exemption from FATCA reporting code', form.exemptFatcaCode)

    section('5. Address (street, apt, suite)', form.address)
    section('6. City, State, ZIP', `${form.city}, ${form.state} ${form.zip}`)
    if (form.accountNumbers) section('7. Account number(s)', form.accountNumbers)

    // TIN
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text('Part I — Taxpayer Identification Number (TIN)', margin, y)
    y += 14
    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    if (form.taxIdType === 'ssn') {
      const masked = `XXX-XX-${form.ssn3}`
      doc.text(`Social Security Number: ${masked}`, margin, y)
    } else {
      const masked = `${form.ein1}-XXXXX${form.ein2.slice(-2)}`
      doc.text(`Employer Identification Number: ${masked}`, margin, y)
    }
    y += 20

    // Certification
    doc.setDrawColor(30, 58, 138)
    doc.setLineWidth(1)
    doc.line(margin, y, w - margin, y)
    y += 16
    doc.setFontSize(10)
    doc.setTextColor(30, 58, 138)
    doc.setFont('helvetica', 'bold')
    doc.text('Part II — Certification', margin, y)
    y += 14
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    const certText = [
      'Under penalties of perjury, I certify that:',
      '1. The number shown on this form is my correct taxpayer identification number,',
      '2. I am not subject to backup withholding because: (a) I am exempt from backup',
      '   withholding, or (b) I have not been notified by the IRS that I am subject to backup',
      '   withholding as a result of a failure to report all interest or dividends, or (c) the IRS',
      '   has notified me that I am no longer subject to backup withholding, and',
      '3. I am a U.S. citizen or other U.S. person.',
      '4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from',
      '   FATCA reporting is correct.',
    ]
    certText.forEach(line => {
      doc.text(line, margin, y)
      y += 11
    })

    y += 12
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.text('Signature: ', margin, y)
    doc.setFont('helvetica', 'italic')
    doc.text(form.name, margin + 60, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`    Date: ${new Date().toLocaleDateString('en-US')}`, margin + 60 + doc.getTextWidth(form.name) + 10, y)
    y += 6
    doc.setDrawColor(30, 58, 138)
    doc.line(margin, y, w - margin, y)

    // Footer
    y += 20
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Generated electronically via DonutDash Driver Portal', margin, y)
    doc.text(`Submitted: ${new Date().toLocaleString('en-US')}`, margin, y + 10)

    return doc.output('blob')
  }

  const handleSubmit = async () => {
    if (!isValid()) {
      setError('Please fill in all required fields.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const pdfBlob = generatePDF()
      const file = new File([pdfBlob], `W9-${form.name.replace(/\s+/g, '_')}-${Date.now()}.pdf`, { type: 'application/pdf' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', 'w9')

      const res = await fetch('/api/driver/documents', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>&#x2705;</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#065F46', marginBottom: 8 }}>W-9 Submitted!</h2>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          Your W-9 form has been uploaded and is now pending admin approval.
        </p>
        <button
          onClick={() => router.push('/driver/documents')}
          style={{
            padding: '12px 32px', borderRadius: 10, border: 'none',
            background: '#FF8C00', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Back to Documents
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push('/driver/documents')} style={{
          background: 'none', border: 'none', color: '#FF8C00', fontWeight: 600,
          fontSize: 14, cursor: 'pointer', padding: 0,
        }}>
          &larr; Back to Documents
        </button>
      </div>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A, #1E40AF)', borderRadius: '14px 14px 0 0',
        padding: '24px 28px', color: '#fff',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Form W-9</h1>
        <p style={{ fontSize: 13, margin: '4px 0 0', opacity: 0.85 }}>
          Request for Taxpayer Identification Number and Certification
        </p>
        <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.65 }}>
          Department of the Treasury &mdash; Internal Revenue Service
        </p>
      </div>

      <div style={{
        background: '#fff', borderRadius: '0 0 14px 14px', border: '1px solid #E5E7EB',
        borderTop: 'none', padding: '28px',
      }}>
        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Line 1 */}
          <div>
            <label style={labelStyle}>1. Name (as shown on your income tax return) <span style={{ color: '#DC2626' }}>*</span></label>
            <input style={inputStyle} placeholder="Enter your legal name"
              value={form.name} onChange={e => set('name', e.target.value)}
              onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
              onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
          </div>

          {/* Line 2 */}
          <div>
            <label style={labelStyle}>2. Business name / disregarded entity name (if different)</label>
            <input style={inputStyle} placeholder="Leave blank if same as above"
              value={form.businessName} onChange={e => set('businessName', e.target.value)}
              onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
              onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
          </div>

          {/* Line 3 — Tax Classification */}
          <div>
            <label style={labelStyle}>3. Federal tax classification <span style={{ color: '#DC2626' }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TAX_CLASSIFICATIONS.map(c => (
                <label key={c.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: '#333', cursor: 'pointer',
                  padding: '6px 10px', borderRadius: 8,
                  background: form.taxClassification === c.key ? '#EEF2FF' : 'transparent',
                  border: form.taxClassification === c.key ? '1px solid #C7D2FE' : '1px solid transparent',
                }}>
                  <input type="radio" name="taxClass" value={c.key}
                    checked={form.taxClassification === c.key}
                    onChange={() => set('taxClassification', c.key)}
                    style={{ accentColor: '#1E3A8A' }} />
                  {c.label}
                </label>
              ))}
            </div>
            {form.taxClassification === 'other' && (
              <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Specify classification"
                value={form.otherClassification} onChange={e => set('otherClassification', e.target.value)} />
            )}
          </div>

          {/* Line 4 — Exemptions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>4. Exempt payee code (if any)</label>
              <input style={inputStyle} placeholder="Code"
                value={form.exemptPayeeCode} onChange={e => set('exemptPayeeCode', e.target.value)}
                onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
            </div>
            <div>
              <label style={labelStyle}>FATCA exemption code (if any)</label>
              <input style={inputStyle} placeholder="Code"
                value={form.exemptFatcaCode} onChange={e => set('exemptFatcaCode', e.target.value)}
                onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
            </div>
          </div>

          {/* Line 5 — Address */}
          <div>
            <label style={labelStyle}>5. Address (number, street, apt or suite no.) <span style={{ color: '#DC2626' }}>*</span></label>
            <input style={inputStyle} placeholder="123 Main St, Apt 4"
              value={form.address} onChange={e => set('address', e.target.value)}
              onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
              onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
          </div>

          {/* Line 6 — City, State, ZIP */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>6. City <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} placeholder="City"
                value={form.city} onChange={e => set('city', e.target.value)}
                onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
            </div>
            <div>
              <label style={labelStyle}>State <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} placeholder="TX" maxLength={2}
                value={form.state} onChange={e => set('state', e.target.value.toUpperCase())}
                onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
            </div>
            <div>
              <label style={labelStyle}>ZIP <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} placeholder="75701" maxLength={10}
                value={form.zip} onChange={e => set('zip', e.target.value)}
                onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
            </div>
          </div>

          {/* Line 7 — Account numbers */}
          <div>
            <label style={labelStyle}>7. List account number(s) here (optional)</label>
            <input style={inputStyle} placeholder="Optional"
              value={form.accountNumbers} onChange={e => set('accountNumbers', e.target.value)}
              onFocus={e => e.currentTarget.style.borderColor = '#1E3A8A'}
              onBlur={e => e.currentTarget.style.borderColor = '#ddd'} />
          </div>

          {/* Part I — TIN */}
          <div style={{
            background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
            padding: 20, marginTop: 8,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1E3A8A', margin: '0 0 4px' }}>
              Part I &mdash; Taxpayer Identification Number (TIN)
            </h3>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 14px' }}>
              Enter your SSN or EIN. Your TIN is securely masked in the generated PDF.
            </p>

            <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="radio" name="taxIdType" checked={form.taxIdType === 'ssn'}
                  onChange={() => set('taxIdType', 'ssn')} style={{ accentColor: '#1E3A8A' }} />
                Social Security Number (SSN)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="radio" name="taxIdType" checked={form.taxIdType === 'ein'}
                  onChange={() => set('taxIdType', 'ein')} style={{ accentColor: '#1E3A8A' }} />
                Employer Identification Number (EIN)
              </label>
            </div>

            {form.taxIdType === 'ssn' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input style={{ ...ssnInputStyle, width: 70 }} maxLength={3} placeholder="XXX"
                  value={form.ssn1} onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
                    set('ssn1', v)
                    if (v.length === 3) (e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus()
                  }} />
                <span style={{ fontSize: 18, color: '#999' }}>-</span>
                <input style={{ ...ssnInputStyle, width: 55 }} maxLength={2} placeholder="XX"
                  value={form.ssn2} onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                    set('ssn2', v)
                    if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus()
                  }} />
                <span style={{ fontSize: 18, color: '#999' }}>-</span>
                <input style={{ ...ssnInputStyle, width: 80 }} maxLength={4} placeholder="XXXX"
                  value={form.ssn3} onChange={e => set('ssn3', e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input style={{ ...ssnInputStyle, width: 60 }} maxLength={2} placeholder="XX"
                  value={form.ein1} onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                    set('ein1', v)
                    if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus()
                  }} />
                <span style={{ fontSize: 18, color: '#999' }}>-</span>
                <input style={{ ...ssnInputStyle, width: 130 }} maxLength={7} placeholder="XXXXXXX"
                  value={form.ein2} onChange={e => set('ein2', e.target.value.replace(/\D/g, '').slice(0, 7))} />
              </div>
            )}
          </div>

          {/* Part II — Certification */}
          <div style={{
            background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A',
            padding: 20, marginTop: 8,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#92400E', margin: '0 0 8px' }}>
              Part II &mdash; Certification
            </h3>
            <p style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6, margin: 0 }}>
              Under penalties of perjury, I certify that: (1) The number shown on this form is my correct
              taxpayer identification number, (2) I am not subject to backup withholding, (3) I am a U.S.
              citizen or other U.S. person, and (4) The FATCA code(s) entered on this form (if any) are correct.
            </p>
            <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
              <strong>Electronic Signature:</strong> {form.name || '(enter your name above)'}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              Date: {new Date().toLocaleDateString('en-US')}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid()}
            style={{
              flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none',
              background: saving || !isValid() ? '#ccc' : '#10B981', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'Generating & Uploading...' : 'Save & Upload W-9'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#999', marginTop: 12, textAlign: 'center' }}>
          Your SSN/EIN is partially masked in the uploaded PDF for security.
          This form will be submitted for admin approval.
        </p>
      </div>
    </div>
  )
}
