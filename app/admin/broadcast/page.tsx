'use client'

import { useEffect, useState } from 'react'

type Counts = { total: number; email: number; phone: number }
type Group = 'drivers' | 'customers' | 'shop_owners' | 'managers'
const GROUPS: Group[] = ['drivers', 'customers', 'shop_owners', 'managers']
const GROUP_LABELS: Record<Group, string> = { drivers: 'Drivers', customers: 'Customers', shop_owners: 'Shop Owners', managers: 'Managers' }

export default function BroadcastPage() {
  const [counts, setCounts] = useState<Record<Group, Counts> | null>(null)
  const [groups, setGroups] = useState<Record<Group, boolean>>({ drivers: true, customers: false, shop_owners: false, managers: false })
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

  const selected = GROUPS.filter(g => groups[g])

  const reach = (() => {
    if (!counts) return null
    const gs = selected.map(g => counts[g])
    return {
      total: gs.reduce((s, g) => s + g.total, 0),
      email: gs.reduce((s, g) => s + g.email, 0),
      phone: gs.reduce((s, g) => s + g.phone, 0),
    }
  })()

  const send = async () => {
    setError(''); setResult(null)
    if (selected.length === 0) return setError('Pick at least one audience.')
    if (!email && !sms) return setError('Pick at least one channel.')
    if (!message.trim()) return setError('Message is required.')
    if (email && !subject.trim()) return setError('Email subject is required.')

    const parts: string[] = []
    if (email && reach) parts.push(`${reach.email} email${reach.email === 1 ? '' : 's'}`)
    if (sms && reach) parts.push(`${reach.phone} text${reach.phone === 1 ? '' : 's'}`)
    const who = selected.map(g => GROUP_LABELS[g].toLowerCase()).join(' + ')
    if (!confirm(`Send this message to ${who} — ${parts.join(' and ')}?\n\nThis cannot be undone.`)) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: selected, channels: { email, sms }, subject, message }),
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

  const groupBox = (g: Group) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
      border: groups[g] ? '2px solid #FF8C00' : '1px solid #ddd', background: groups[g] ? '#FFF5E6' : '#fff' }}>
      <input type="checkbox" checked={groups[g]} onChange={e => setGroups(prev => ({ ...prev, [g]: e.target.checked }))} />
      {GROUP_LABELS[g]}{counts ? ` (${counts[g].total})` : ''}
    </label>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📢 Broadcast</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Send a one-time message to drivers, customers, shop owners, and/or managers by email and/or text.</p>

      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Audience</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {GROUPS.map(g => <span key={g}>{groupBox(g)}</span>)}
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
      }}>{sending ? 'Sending…' : `Send broadcast${reach ? ` to ${reach.total}` : ''}`}</button>
    </div>
  )
}
