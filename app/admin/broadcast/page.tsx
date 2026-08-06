'use client'

import { useEffect, useState } from 'react'

type Counts = { total: number; email: number; phone: number }

export default function BroadcastPage() {
  const [counts, setCounts] = useState<{ drivers: Counts; customers: Counts } | null>(null)
  const [audience, setAudience] = useState<'drivers' | 'customers' | 'both'>('drivers')
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/broadcast').then(r => r.json()).then(d => { if (d.drivers) setCounts(d) }).catch(() => {})
  }, [])

  const reach = (() => {
    if (!counts) return null
    const groups = audience === 'both' ? [counts.drivers, counts.customers] : audience === 'drivers' ? [counts.drivers] : [counts.customers]
    return {
      total: groups.reduce((s, g) => s + g.total, 0),
      email: groups.reduce((s, g) => s + g.email, 0),
      phone: groups.reduce((s, g) => s + g.phone, 0),
    }
  })()

  const send = async () => {
    setError(''); setResult(null)
    if (!email && !sms) return setError('Pick at least one channel.')
    if (!message.trim()) return setError('Message is required.')
    if (email && !subject.trim()) return setError('Email subject is required.')

    const parts: string[] = []
    if (email && reach) parts.push(`${reach.email} email${reach.email === 1 ? '' : 's'}`)
    if (sms && reach) parts.push(`${reach.phone} text${reach.phone === 1 ? '' : 's'}`)
    if (!confirm(`Send this message to ${audience === 'both' ? 'drivers + customers' : audience} — ${parts.join(' and ')}?\n\nThis cannot be undone.`)) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, channels: { email, sms }, subject, message }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Send failed'); return }
      const bits: string[] = []
      if (d.email) bits.push(`Email: ${d.email.sent} sent${d.email.failed ? `, ${d.email.failed} failed` : ''}`)
      if (d.sms) bits.push(`SMS: ${d.sms.sent} sent${d.sms.failed ? `, ${d.sms.failed} failed` : ''}`)
      setResult(`Sent to ${d.recipients} recipients — ${bits.join(' · ')}`)
      setSubject(''); setMessage('')
    } catch { setError('Send failed') }
    finally { setSending(false) }
  }

  const audienceBtn = (key: 'drivers' | 'customers' | 'both', label: string) => (
    <button onClick={() => setAudience(key)} style={{
      padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
      border: audience === key ? '2px solid #FF8C00' : '1px solid #ddd',
      background: audience === key ? '#FFF5E6' : '#fff', color: audience === key ? '#FF8C00' : '#444',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📢 Broadcast</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Send a one-time message to drivers and/or customers by email and/or text.</p>

      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Audience</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {audienceBtn('drivers', `Drivers${counts ? ` (${counts.drivers.total})` : ''}`)}
        {audienceBtn('customers', `Customers${counts ? ` (${counts.customers.total})` : ''}`)}
        {audienceBtn('both', 'Both')}
      </div>

      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, margin: '16px 0 8px' }}>Channels</label>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> 📧 Email{reach ? ` (${reach.email})` : ''}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> 📱 Text{reach ? ` (${reach.phone})` : ''}
        </label>
      </div>

      {email && (
        <>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13, margin: '16px 0 6px' }}>Email subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Important update from DonutDash"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
        </>
      )}

      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, margin: '16px 0 6px' }}>Message</label>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
        placeholder="Type your message. This exact text is sent as the SMS body and inside the email."
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical' }} />
      {sms && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{message.length} chars · ~{Math.max(1, Math.ceil(message.length / 160))} SMS segment(s) per recipient</div>}

      {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 16 }}>{error}</div>}
      {result && <div style={{ background: '#DCFCE7', color: '#16A34A', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 16 }}>{result}</div>}

      <button onClick={send} disabled={sending} style={{
        marginTop: 20, padding: '12px 28px', borderRadius: 10, border: 'none',
        background: sending ? '#ccc' : '#FF8C00', color: '#fff', fontSize: 15, fontWeight: 700,
        cursor: sending ? 'default' : 'pointer',
      }}>{sending ? 'Sending…' : `Send broadcast${reach ? ` to ${audience === 'both' ? reach.total : (audience === 'drivers' ? counts?.drivers.total : counts?.customers.total) ?? reach.total}` : ''}`}</button>
    </div>
  )
}
