'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'

const TAX_CLASSIFICATIONS = [
  { key: 'individual', label: 'Individual/sole proprietor or single-member LLC', short: 'Individual/sole proprietor' },
  { key: 'c_corp', label: 'C Corporation', short: 'C Corp' },
  { key: 's_corp', label: 'S Corporation', short: 'S Corp' },
  { key: 'partnership', label: 'Partnership', short: 'Partnership' },
  { key: 'trust', label: 'Trust/estate', short: 'Trust/estate' },
  { key: 'llc', label: 'Limited liability company (enter tax classification: C=C corporation, S=S corporation, P=Partnership)', short: 'LLC' },
  { key: 'other', label: 'Other (see instructions)', short: 'Other' },
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
    llcClassification: '',
    otherClassification: '',
    exemptPayeeCode: '',
    exemptFatcaCode: '',
    address: '',
    cityStateZip: '',
    requesterName: '',
    accountNumbers: '',
    ssn1: '', ssn2: '', ssn3: '',
    ein1: '', ein2: '',
    taxIdType: 'ssn' as 'ssn' | 'ein',
    certify: false,
  })

  const set = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }))

  // Styles matching IRS form appearance
  const cellStyle: React.CSSProperties = {
    borderBottom: '1px solid #000', padding: '2px 6px 6px', position: 'relative',
  }
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10, color: '#000', lineHeight: 1.2, marginBottom: 2,
  }
  const fieldInputStyle: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none', fontSize: 14,
    fontFamily: 'Arial, sans-serif', padding: '4px 0', background: 'transparent',
    boxSizing: 'border-box',
  }
  const ssnBoxStyle: React.CSSProperties = {
    width: 28, height: 32, border: '1px solid #000', textAlign: 'center',
    fontSize: 16, fontWeight: 700, fontFamily: 'Courier, monospace',
    outline: 'none', background: '#fff',
  }

  const isValid = () => {
    if (!form.name.trim()) return false
    if (!form.address.trim() || !form.cityStateZip.trim()) return false
    if (!form.certify) return false
    if (form.taxIdType === 'ssn') {
      if (form.ssn1.length !== 3 || form.ssn2.length !== 2 || form.ssn3.length !== 4) return false
    } else {
      if (form.ein1.length !== 2 || form.ein2.length !== 7) return false
    }
    return true
  }

  const generatePDF = (): Blob => {
    const doc = new jsPDF('p', 'pt', 'letter')
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const m = 36 // margin
    const rw = W - m * 2 // row width
    let y = m

    // === TOP HEADER BAR ===
    // Left column: Form info
    doc.setFillColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(1.5)
    doc.rect(m, y, rw, 60)

    // Left section
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    doc.text('Department of the Treasury', m + 4, y + 10)
    doc.text('Internal Revenue Service', m + 4, y + 18)

    // Center: Form title
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Form', m + 130, y + 22)
    doc.setFontSize(28)
    doc.text('W-9', m + 168, y + 22)

    // Subtitle
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Request for Taxpayer', m + 130, y + 36)
    doc.text('Identification Number and Certification', m + 130, y + 47)

    // Right: OMB
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Give Form to the', W - m - 100, y + 14)
    doc.text('requester. Do not', W - m - 100, y + 22)
    doc.text('send to the IRS.', W - m - 100, y + 30)

    y += 60

    // === LINE 1: Name ===
    doc.setLineWidth(0.5)
    doc.rect(m, y, rw, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('1', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  Name (as shown on your income tax return). Name is required on this line; do not leave this line blank.', m + 8, y + 8)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(form.name, m + 6, y + 22)
    y += 28

    // === LINE 2: Business name ===
    doc.rect(m, y, rw, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('2', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  Business name/disregarded entity name, if different from above', m + 8, y + 8)
    if (form.businessName) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(form.businessName, m + 6, y + 22)
    }
    y += 28

    // === LINE 3: Tax classification ===
    const taxClassRow = 28
    doc.rect(m, y, rw, taxClassRow)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('3', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  Check appropriate box for federal tax classification of the person whose name is entered on line 1.', m + 8, y + 8)

    // Checkboxes
    const classifications = [
      { key: 'individual', label: 'Individual/sole proprietor or single-member LLC', x: m + 6 },
      { key: 'c_corp', label: 'C Corporation', x: m + 238 },
      { key: 's_corp', label: 'S Corporation', x: m + 310 },
      { key: 'partnership', label: 'Partnership', x: m + 382 },
      { key: 'trust', label: 'Trust/estate', x: m + 442 },
    ]
    const checkY = y + 20
    classifications.forEach(c => {
      doc.rect(c.x, checkY - 6, 7, 7)
      if (form.taxClassification === c.key) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('X', c.x + 1.2, checkY + 0.5)
      }
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(c.label, c.x + 10, checkY + 1)
    })
    y += taxClassRow

    // === LINE 4: Exemptions ===
    doc.rect(m, y, rw, 24)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('4', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  Exemptions (codes apply only to certain entities, not individuals):', m + 8, y + 8)
    if (form.exemptPayeeCode) {
      doc.text(`Exempt payee code: ${form.exemptPayeeCode}`, m + 300, y + 8)
    }
    if (form.exemptFatcaCode) {
      doc.text(`FATCA exemption code: ${form.exemptFatcaCode}`, m + 300, y + 18)
    }
    y += 24

    // === LINE 5: Address ===
    doc.rect(m, y, rw * 0.65, 28)
    doc.rect(m + rw * 0.65, y, rw * 0.35, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('5', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  Address (number, street, and apt. or suite no.) See instructions.', m + 8, y + 8)
    doc.setFontSize(11)
    doc.text(form.address, m + 6, y + 22)

    // Requester name on the right
    doc.setFontSize(7)
    doc.text("Requester's name and address (optional)", m + rw * 0.65 + 4, y + 8)
    if (form.requesterName) {
      doc.setFontSize(9)
      doc.text(form.requesterName, m + rw * 0.65 + 4, y + 20)
    }
    y += 28

    // === LINE 6: City, state, ZIP ===
    doc.rect(m, y, rw * 0.65, 28)
    doc.rect(m + rw * 0.65, y, rw * 0.35, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('6', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  City, state, and ZIP code', m + 8, y + 8)
    doc.setFontSize(11)
    doc.text(form.cityStateZip, m + 6, y + 22)
    y += 28

    // === LINE 7: Account numbers ===
    doc.rect(m, y, rw, 24)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('7', m + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text('  List account number(s) here (optional)', m + 8, y + 8)
    if (form.accountNumbers) {
      doc.setFontSize(10)
      doc.text(form.accountNumbers, m + 6, y + 19)
    }
    y += 24

    // === PART I — TIN ===
    y += 6
    doc.setLineWidth(1.5)
    doc.line(m, y, m + rw, y)
    y += 2
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Part I', m + 3, y + 12)
    doc.setFontSize(10)
    doc.text('Taxpayer Identification Number (TIN)', m + 40, y + 12)
    y += 18

    doc.setLineWidth(0.5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid', m + 3, y + 8)
    doc.text('backup withholding.', m + 3, y + 17)

    // SSN/EIN boxes on right
    const tinX = W - m - 180
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Social security number', tinX, y + 8)

    if (form.taxIdType === 'ssn') {
      const masked = `XXX-XX-${form.ssn3}`
      doc.setFontSize(14)
      doc.setFont('courier', 'bold')
      doc.text(masked, tinX + 10, y + 24)
    }

    y += 30
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('or', tinX - 10, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.text('Employer identification number', tinX, y + 4)

    if (form.taxIdType === 'ein') {
      const masked = `${form.ein1}-XXXXX${form.ein2.slice(-2)}`
      doc.setFontSize(14)
      doc.setFont('courier', 'bold')
      doc.text(masked, tinX + 10, y + 18)
    }
    y += 24

    // === PART II — Certification ===
    y += 6
    doc.setLineWidth(1.5)
    doc.line(m, y, m + rw, y)
    y += 2
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Part II', m + 3, y + 12)
    doc.setFontSize(10)
    doc.text('Certification', m + 44, y + 12)
    y += 18

    doc.setLineWidth(0.5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const certLines = [
      'Under penalties of perjury, I certify that:',
      '1.  The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and',
      '2.  I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the',
      '     Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or',
      '     (c) the IRS has notified me that I am no longer subject to backup withholding; and',
      '3.  I am a U.S. citizen or other U.S. person (defined below); and',
      '4.  The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.',
    ]
    certLines.forEach(line => {
      doc.text(line, m + 3, y + 8)
      y += 10
    })

    // Signature line
    y += 10
    doc.setLineWidth(1)
    doc.line(m, y, m + rw, y)
    y += 4
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Sign', m + 3, y + 10)
    doc.text('Here', m + 3, y + 18)

    doc.setFont('helvetica', 'normal')
    doc.text('Signature of', m + 30, y + 8)
    doc.text('U.S. person >', m + 30, y + 16)

    doc.setFontSize(14)
    doc.setFont('helvetica', 'italic')
    doc.text(form.name, m + 100, y + 14)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Date >', W - m - 120, y + 12)
    doc.setFontSize(11)
    doc.text(new Date().toLocaleDateString('en-US'), W - m - 90, y + 12)

    y += 24
    doc.setLineWidth(1)
    doc.line(m, y, m + rw, y)

    // Footer
    y += 12
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text('Generated electronically via DonutDash Driver Portal', m, y)
    doc.text(`Submitted: ${new Date().toLocaleString('en-US')}`, m, y + 10)

    // Form number footer
    doc.setTextColor(0)
    doc.setFontSize(7)
    doc.text('Form W-9 (Rev. 3-2024)', m, H - 30)
    doc.text(`Cat. No. 10231X`, m + 120, H - 30)

    return doc.output('blob')
  }

  const handleSubmit = async () => {
    if (!isValid()) {
      setError('Please fill in all required fields and check the certification box.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const fullTaxId = form.taxIdType === 'ssn'
        ? `${form.ssn1}${form.ssn2}${form.ssn3}`
        : `${form.ein1}${form.ein2}`

      // Parse city/state/zip
      const parts = form.cityStateZip.split(',').map(s => s.trim())
      const city = parts[0] || ''
      const stateZip = (parts[1] || '').trim().split(/\s+/)
      const state = stateZip[0] || ''
      const zip = stateZip.slice(1).join(' ') || ''

      const w9Res = await fetch('/api/driver/w9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: form.name,
          business_name: form.businessName,
          tax_classification: form.taxClassification,
          address: form.address,
          city, state, zip,
          tax_id_type: form.taxIdType,
          tax_id: fullTaxId,
        }),
      })

      if (!w9Res.ok) {
        const w9Data = await w9Res.json()
        setError(w9Data.error || 'Failed to save W-9 data')
        setSaving(false)
        return
      }

      const pdfBlob = generatePDF()
      const file = new File([pdfBlob], `W9-${form.name.replace(/\s+/g, '_')}-${Date.now()}.pdf`, { type: 'application/pdf' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', 'w9')

      const res = await fetch('/api/driver/documents', { method: 'POST', body: formData })

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
        <button onClick={() => router.push('/driver/documents')} style={{
          padding: '12px 32px', borderRadius: 10, border: 'none',
          background: '#FF8C00', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Back to Documents
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => router.push('/driver/documents')} style={{
          background: 'none', border: 'none', color: '#FF8C00', fontWeight: 600,
          fontSize: 14, cursor: 'pointer', padding: 0,
        }}>
          &larr; Back to Documents
        </button>
      </div>

      {/* === IRS-STYLE FORM === */}
      <div style={{ border: '2px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff' }}>

        {/* TOP HEADER */}
        <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
          {/* Left: Department */}
          <div style={{ width: 160, borderRight: '2px solid #000', padding: '8px 10px', fontSize: 9, lineHeight: 1.4 }}>
            <div>Department of the Treasury</div>
            <div>Internal Revenue Service</div>
          </div>
          {/* Center: Title */}
          <div style={{ flex: 1, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800, marginRight: 6 }}>Form</span>
              <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: 1 }}>W-9</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
              Request for Taxpayer<br />Identification Number and Certification
            </div>
          </div>
          {/* Right: Instructions */}
          <div style={{ width: 160, borderLeft: '2px solid #000', padding: '10px', fontSize: 9, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700 }}>Give Form to the requester. Do not send to the IRS.</div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', padding: '8px 14px', color: '#DC2626', fontSize: 13, borderBottom: '1px solid #DC2626' }}>
            {error}
          </div>
        )}

        {/* LINE 1: Name */}
        <div style={cellStyle}>
          <div style={fieldLabelStyle}>
            <strong>1</strong>&ensp;Name (as shown on your income tax return). Name is required on this line; do not leave this line blank.
          </div>
          <input style={fieldInputStyle} value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Enter your legal name" />
        </div>

        {/* LINE 2: Business name */}
        <div style={cellStyle}>
          <div style={fieldLabelStyle}>
            <strong>2</strong>&ensp;Business name/disregarded entity name, if different from above
          </div>
          <input style={fieldInputStyle} value={form.businessName} onChange={e => set('businessName', e.target.value)}
            placeholder="" />
        </div>

        {/* LINE 3: Tax classification */}
        <div style={{ ...cellStyle, paddingBottom: 10 }}>
          <div style={fieldLabelStyle}>
            <strong>3</strong>&ensp;Check appropriate box for federal tax classification of the person whose name is entered on line 1. Check only <strong>one</strong> of the following seven boxes.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
            {TAX_CLASSIFICATIONS.map(c => (
              <label key={c.key} style={{
                display: 'inline-flex', alignItems: 'flex-start', gap: 4,
                fontSize: 11, cursor: 'pointer', lineHeight: 1.3,
              }}>
                <input type="checkbox" checked={form.taxClassification === c.key}
                  onChange={() => set('taxClassification', c.key)}
                  style={{ marginTop: 2, width: 13, height: 13, accentColor: '#000' }} />
                <span>{c.short}</span>
              </label>
            ))}
          </div>
          {form.taxClassification === 'llc' && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              LLC tax classification (C, S, or P):&ensp;
              <input style={{ width: 30, border: '1px solid #000', textAlign: 'center', fontSize: 13, fontWeight: 700, padding: '2px' }}
                maxLength={1} value={form.llcClassification}
                onChange={e => set('llcClassification', e.target.value.toUpperCase())} />
            </div>
          )}
          {form.taxClassification === 'other' && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              Other:&ensp;
              <input style={{ width: 200, borderBottom: '1px solid #000', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', fontSize: 12, outline: 'none' }}
                value={form.otherClassification} onChange={e => set('otherClassification', e.target.value)} />
            </div>
          )}
        </div>

        {/* LINE 4: Exemptions */}
        <div style={{ ...cellStyle, display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabelStyle}>
              <strong>4</strong>&ensp;Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 10 }}>
              Exempt payee code (if any)&ensp;
              <input style={{ width: 40, borderBottom: '1px solid #000', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', textAlign: 'center', fontSize: 12, outline: 'none' }}
                value={form.exemptPayeeCode} onChange={e => set('exemptPayeeCode', e.target.value)} />
            </div>
            <div style={{ fontSize: 10 }}>
              FATCA code (if any)&ensp;
              <input style={{ width: 40, borderBottom: '1px solid #000', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', textAlign: 'center', fontSize: 12, outline: 'none' }}
                value={form.exemptFatcaCode} onChange={e => set('exemptFatcaCode', e.target.value)} />
            </div>
          </div>
        </div>

        {/* LINE 5 + Requester */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <div style={{ flex: 1, padding: '2px 6px 6px', borderRight: '1px solid #000' }}>
            <div style={fieldLabelStyle}>
              <strong>5</strong>&ensp;Address (number, street, and apt. or suite no.) See instructions.
            </div>
            <input style={fieldInputStyle} value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="123 Main St, Apt 4" />
          </div>
          <div style={{ width: 200, padding: '2px 6px 6px' }}>
            <div style={{ ...fieldLabelStyle, fontSize: 9 }}>Requester&apos;s name and address (optional)</div>
            <input style={{ ...fieldInputStyle, fontSize: 11 }} value={form.requesterName}
              onChange={e => set('requesterName', e.target.value)} />
          </div>
        </div>

        {/* LINE 6: City, state, ZIP */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <div style={{ flex: 1, padding: '2px 6px 6px', borderRight: '1px solid #000' }}>
            <div style={fieldLabelStyle}>
              <strong>6</strong>&ensp;City, state, and ZIP code
            </div>
            <input style={fieldInputStyle} value={form.cityStateZip}
              onChange={e => set('cityStateZip', e.target.value)}
              placeholder="Tyler, TX 75701" />
          </div>
          <div style={{ width: 200, padding: '2px 6px 6px' }}>
            <div style={{ ...fieldLabelStyle, fontSize: 9 }}>&nbsp;</div>
          </div>
        </div>

        {/* LINE 7: Account numbers */}
        <div style={cellStyle}>
          <div style={fieldLabelStyle}>
            <strong>7</strong>&ensp;List account number(s) here (optional)
          </div>
          <input style={fieldInputStyle} value={form.accountNumbers} onChange={e => set('accountNumbers', e.target.value)} />
        </div>

        {/* === PART I: TIN === */}
        <div style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', padding: '8px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                Part I&emsp;<span style={{ fontWeight: 700 }}>Taxpayer Identification Number (TIN)</span>
              </div>
              <div style={{ fontSize: 10, lineHeight: 1.5, color: '#333', maxWidth: 380 }}>
                Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid
                backup withholding. For individuals, this is generally your social security number (SSN).
                For other entities, it is your employer identification number (EIN).
              </div>
            </div>

            {/* TIN boxes */}
            <div style={{ marginLeft: 20, flexShrink: 0 }}>
              {/* SSN */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="radio" name="taxIdType" checked={form.taxIdType === 'ssn'}
                    onChange={() => set('taxIdType', 'ssn')} style={{ accentColor: '#000' }} />
                  Social security number
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: form.taxIdType === 'ssn' ? 1 : 0.3 }}>
                  {[0,1,2].map(i => (
                    <input key={`s1-${i}`} style={ssnBoxStyle} maxLength={1}
                      value={form.ssn1[i] || ''} disabled={form.taxIdType !== 'ssn'}
                      onChange={e => {
                        const v = form.ssn1.split('')
                        v[i] = e.target.value.replace(/\D/g, '')
                        const newVal = v.join('').slice(0, 3)
                        set('ssn1', newVal)
                        if (e.target.value && i < 2) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                        else if (e.target.value && i === 2) {
                          const next = e.target.parentElement?.querySelectorAll('input')
                          if (next && next[4]) (next[4] as HTMLInputElement).focus()
                        }
                      }} />
                  ))}
                  <span style={{ fontSize: 16, fontWeight: 700, margin: '0 2px' }}>-</span>
                  {[0,1].map(i => (
                    <input key={`s2-${i}`} style={ssnBoxStyle} maxLength={1}
                      value={form.ssn2[i] || ''} disabled={form.taxIdType !== 'ssn'}
                      onChange={e => {
                        const v = form.ssn2.split('')
                        v[i] = e.target.value.replace(/\D/g, '')
                        const newVal = v.join('').slice(0, 2)
                        set('ssn2', newVal)
                        if (e.target.value && i < 1) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                        else if (e.target.value && i === 1) {
                          const next = e.target.parentElement?.querySelectorAll('input')
                          if (next && next[6]) (next[6] as HTMLInputElement).focus()
                        }
                      }} />
                  ))}
                  <span style={{ fontSize: 16, fontWeight: 700, margin: '0 2px' }}>-</span>
                  {[0,1,2,3].map(i => (
                    <input key={`s3-${i}`} style={ssnBoxStyle} maxLength={1}
                      value={form.ssn3[i] || ''} disabled={form.taxIdType !== 'ssn'}
                      onChange={e => {
                        const v = form.ssn3.split('')
                        v[i] = e.target.value.replace(/\D/g, '')
                        const newVal = v.join('').slice(0, 4)
                        set('ssn3', newVal)
                        if (e.target.value && i < 3) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                      }} />
                  ))}
                </div>
              </div>

              {/* EIN */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="radio" name="taxIdType" checked={form.taxIdType === 'ein'}
                    onChange={() => set('taxIdType', 'ein')} style={{ accentColor: '#000' }} />
                  Employer identification number
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: form.taxIdType === 'ein' ? 1 : 0.3 }}>
                  {[0,1].map(i => (
                    <input key={`e1-${i}`} style={ssnBoxStyle} maxLength={1}
                      value={form.ein1[i] || ''} disabled={form.taxIdType !== 'ein'}
                      onChange={e => {
                        const v = form.ein1.split('')
                        v[i] = e.target.value.replace(/\D/g, '')
                        const newVal = v.join('').slice(0, 2)
                        set('ein1', newVal)
                        if (e.target.value && i < 1) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                        else if (e.target.value && i === 1) {
                          const next = e.target.parentElement?.querySelectorAll('input')
                          if (next && next[3]) (next[3] as HTMLInputElement).focus()
                        }
                      }} />
                  ))}
                  <span style={{ fontSize: 16, fontWeight: 700, margin: '0 2px' }}>-</span>
                  {[0,1,2,3,4,5,6].map(i => (
                    <input key={`e2-${i}`} style={ssnBoxStyle} maxLength={1}
                      value={form.ein2[i] || ''} disabled={form.taxIdType !== 'ein'}
                      onChange={e => {
                        const v = form.ein2.split('')
                        v[i] = e.target.value.replace(/\D/g, '')
                        const newVal = v.join('').slice(0, 7)
                        set('ein2', newVal)
                        if (e.target.value && i < 6) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                      }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === PART II: Certification === */}
        <div style={{ borderBottom: '2px solid #000', padding: '8px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
            Part II&emsp;<span style={{ fontWeight: 700 }}>Certification</span>
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.6, color: '#333' }}>
            Under penalties of perjury, I certify that:
          </div>
          <ol style={{ fontSize: 10, lineHeight: 1.6, color: '#333', margin: '4px 0 0', paddingLeft: 20 }}>
            <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
            <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
            <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
            <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
          </ol>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px',
            background: form.certify ? '#F0FDF4' : '#FFF7ED', border: form.certify ? '1px solid #86EFAC' : '1px solid #FDE68A',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <input type="checkbox" checked={form.certify} onChange={e => set('certify', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#000' }} />
            I certify the above statements are true and correct.
          </label>
        </div>

        {/* SIGNATURE SECTION */}
        <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
          <div style={{
            width: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            borderRight: '1px solid #000', padding: '8px 4px', fontSize: 12, fontWeight: 800, lineHeight: 1.3,
          }}>
            <div>Sign</div>
            <div>Here</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10 }}>Signature of<br />U.S. person &gt;</div>
              <div style={{
                flex: 1, borderBottom: '1px solid #000', padding: '4px 8px', minHeight: 24,
                fontFamily: 'cursive, serif', fontSize: 18, fontStyle: 'italic', color: '#1a1a1a',
              }}>
                {form.name || ''}
              </div>
              <div style={{ fontSize: 10, flexShrink: 0 }}>Date &gt;</div>
              <div style={{ borderBottom: '1px solid #000', padding: '4px 8px', minWidth: 100, fontSize: 13 }}>
                {new Date().toLocaleDateString('en-US')}
              </div>
            </div>
          </div>
        </div>

        {/* FORM FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', fontSize: 9, color: '#666' }}>
          <span>Form <strong>W-9</strong> (Rev. 3-2024)</span>
          <span>Cat. No. 10231X</span>
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !isValid()}
          style={{
            flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none',
            background: saving || !isValid() ? '#ccc' : '#10B981', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Generating & Uploading...' : 'Save & Submit W-9'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#999', marginTop: 10, textAlign: 'center' }}>
        Your SSN/EIN is stored securely. The uploaded PDF shows only the last 4 digits.
      </p>
    </div>
  )
}
