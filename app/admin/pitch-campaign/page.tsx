'use client'

// Admin surface for managing the recurring pitch outreach list.
// Each row = one (shop_id, recipient_email) target. The weekly cron
// emails active rows with the pitch landing link; "Send now" lets you
// trigger one immediately. The "Pitch →" column jumps to the per-shop
// pitch viewer so you can preview what the recipient will see.

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Recipient {
  id: string
  shop_id: string
  recipient_email: string
  recipient_name: string | null
  recipient_phone: string | null
  notes: string | null
  status: 'active' | 'paused' | 'replied'
  last_sent_at: string | null
  send_count: number
  unsubscribed_at: string | null
  created_at: string
  shop: { name: string; slug: string; city: string | null; is_claimed: boolean } | null
}

interface Shop {
  id: string
  name: string
  slug: string
  city: string
  is_claimed: boolean
}

export default function PitchCampaignPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [shops, setShops] = useState<Shop[]>([])
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    load()
    // Also fetch unclaimed shops for the add-form dropdown.
    fetch('/api/shops?limit=200&include_unclaimed=1')
      .then((r) => r.json())
      .then((d) => setShops((d.shops as Shop[]).filter((s) => !s.is_claimed)))
      .catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/pitch-campaign')
      const d = await r.json()
      setRecipients(d.recipients ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setActioning(id)
    try {
      const r = await fetch(`/api/admin/pitch-campaign/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        alert(d.error ?? 'Update failed')
        return
      }
      await load()
    } finally {
      setActioning(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this recipient from the campaign?')) return
    setActioning(id)
    try {
      await fetch(`/api/admin/pitch-campaign/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setActioning(null)
    }
  }

  async function sendNow(id: string) {
    if (!confirm('Send the pitch email to this recipient now?')) return
    setActioning(id)
    try {
      const r = await fetch(`/api/admin/pitch-campaign/${id}/send`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error ?? 'Send failed')
      } else {
        alert('Email sent.')
        await load()
      }
    } finally {
      setActioning(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Pitch Campaign</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: 14 }}>
            Weekly auto-email outreach to prospective shop owners. Active rows are emailed every Monday.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: '#FF8C00', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          + Add Recipient
        </button>
      </div>

      {showAdd && <AddForm shops={shops} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}

      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading…</p>
      ) : recipients.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#6B7280', margin: 0 }}>No recipients yet. Add the first prospective shop owner above.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                {['Shop', 'Recipient', 'Phone', 'Status', 'Last Sent', 'Sends', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => {
                const isUnsubbed = !!r.unsubscribed_at
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: '#1A1A2E' }}>{r.shop?.name ?? '(deleted)'}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{r.shop?.city ?? ''}{r.shop?.is_claimed && ' · CLAIMED'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <div>{r.recipient_name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{r.recipient_email}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#6B7280' }}>{r.recipient_phone ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>
                      {isUnsubbed ? (
                        <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>UNSUBSCRIBED</span>
                      ) : (
                        <select
                          value={r.status}
                          onChange={(e) => patch(r.id, { status: e.target.value })}
                          disabled={actioning === r.id}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12 }}
                        >
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="replied">replied</option>
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>
                      {r.last_sent_at ? new Date(r.last_sent_at).toLocaleDateString() : 'never'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>{r.send_count}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Link
                          href={`/admin/shops/${r.shop_id}/pitch`}
                          style={{ background: '#EEF2FF', color: '#4F46E5', padding: '4px 10px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}
                        >
                          Pitch
                        </Link>
                        {!isUnsubbed && r.status === 'active' && (
                          <button
                            onClick={() => sendNow(r.id)}
                            disabled={actioning === r.id}
                            style={{ background: '#FF8C00', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                          >
                            Send now
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          disabled={actioning === r.id}
                          style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', padding: '4px 10px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddForm({ shops, onClose, onCreated }: { shops: Shop[]; onClose: () => void; onCreated: () => void }) {
  const [shopId, setShopId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!shopId || !email) {
      alert('Pick a shop and enter an email')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/pitch-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          recipient_email: email,
          recipient_name: name || undefined,
          recipient_phone: phone || undefined,
          notes: notes || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error ?? 'Create failed')
        return
      }
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Add Recipient</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>Shop *</label>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={input}>
            <option value="">Select a shop…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Recipient Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} placeholder="owner@example.com" />
        </div>
        <div>
          <label style={lbl}>Recipient Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="(optional)" />
        </div>
        <div>
          <label style={lbl}>Phone (for manual SMS only — not auto-blasted)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input} placeholder="(optional)" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} placeholder='e.g. "Owner is John, prefers email"' />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={submitting} style={{ background: '#FF8C00', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          {submitting ? 'Adding…' : 'Add to Campaign'}
        </button>
        <button onClick={onClose} style={{ background: '#fff', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }
