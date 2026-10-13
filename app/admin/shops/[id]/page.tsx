'use client'

// Manage one shop: its own details, and the account of whoever owns it.
//
// The Shops list could toggle a shop on and off and edit its fees, but a name
// typo, a moved store or an owner locked out of their account all meant a trip
// to the database. Both halves live here because they are the same job — "fix
// this shop" — even though they are two different tables.
//
// Owner edits go through /api/admin/users rather than a new endpoint: that
// route already gates email and password changes to admins and already drives
// Supabase's admin API, and a second path to a password change is a second
// path to get wrong.

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Owner = { id: string; name: string; email: string; phone: string | null } | null
type Shop = {
  id: string; shop_number: number; name: string; slug: string
  address: string; city: string; state: string; zip: string; phone: string | null
  lat: number | null; lng: number | null
  is_active: boolean; owner: Owner
}

export default function AdminShopDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const [sf, setSf] = useState({ name: '', phone: '', address: '', city: '', state: '', zip: '' })
  const [of_, setOf] = useState({ name: '', email: '', phone: '' })
  const [pw, setPw] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // No per-shop GET exists; the list endpoint already returns everything
      // this page needs, and 88 shops is not worth a second route.
      const res = await fetch('/api/admin/shops')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      const found = (d.shops || []).find((s: Shop) => s.id === id)
      if (!found) throw new Error('Shop not found')
      setShop(found)
      setSf({
        name: found.name ?? '', phone: found.phone ?? '', address: found.address ?? '',
        city: found.city ?? '', state: found.state ?? '', zip: found.zip ?? '',
      })
      setOf({ name: found.owner?.name ?? '', email: found.owner?.email ?? '', phone: found.owner?.phone ?? '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shop')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000) }

  async function saveShop() {
    setSaving('shop'); setError(null)
    try {
      const body: Record<string, unknown> = { id, ...sf }
      // Re-geocode when the address changed. Delivery quotes, dispatch and the
      // pickup pin all read lat/lng — saving a new address against the old
      // coordinates routes drivers to where the shop used to be.
      const moved = shop && (sf.address !== shop.address || sf.city !== shop.city
        || sf.state !== shop.state || sf.zip !== shop.zip)
      if (moved) {
        const q = `${sf.address}, ${sf.city}, ${sf.state} ${sf.zip}`
        const g = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`)
        if (g.ok) {
          const gd = await g.json()
          if (Number.isFinite(gd.lat) && Number.isFinite(gd.lng)) { body.lat = gd.lat; body.lng = gd.lng }
        } else {
          // Saving the address with stale coordinates is the one outcome worth
          // refusing — it is invisible until a driver is sent to the wrong place.
          setError('Could not find that address. Check it, or the shop would keep its old map location.')
          setSaving(null); return
        }
      }
      const res = await fetch('/api/admin/shops', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      flash(moved ? 'Shop saved, and the map location updated.' : 'Shop saved.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSaving(null) }
  }

  async function saveOwner(extra?: Record<string, unknown>) {
    if (!shop?.owner) return
    setSaving(extra?.new_password ? 'password' : 'owner'); setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shop.owner.id, ...(extra ?? of_) }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      flash(extra?.new_password ? 'Password changed.' : 'Owner saved.')
      setPw('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSaving(null) }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ padding: '20px 18px 48px', maxWidth: 720 }}>
      <button onClick={() => router.push('/admin/shops')} style={back}>&larr; All shops</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 2px' }}>
        {shop?.name || 'Shop'} <span style={{ color: '#9CA3AF', fontWeight: 600 }}>#{shop?.shop_number}</span>
      </h1>
      <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 18px' }}>
        {shop?.is_active ? 'Active' : 'Inactive'} · /{shop?.slug}
      </p>

      {msg && <div style={banner('#065F46', '#ECFDF5', '#A7F3D0')}>{msg}</div>}
      {error && <div style={banner('#B42318', '#FFF6F6', '#F3C2C2')}>{error}</div>}

      <section style={cardBox}>
        <h2 style={h2}>Shop details</h2>
        <Field label="Shop name" value={sf.name} onChange={(v) => setSf({ ...sf, name: v })} />
        <Field label="Phone" value={sf.phone} onChange={(v) => setSf({ ...sf, phone: v })} placeholder="903-555-0100" />
        <Field label="Street address" value={sf.address} onChange={(v) => setSf({ ...sf, address: v })} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="City" value={sf.city} onChange={(v) => setSf({ ...sf, city: v })} />
          <Field label="State" value={sf.state} onChange={(v) => setSf({ ...sf, state: v })} width={90} />
          <Field label="ZIP" value={sf.zip} onChange={(v) => setSf({ ...sf, zip: v })} width={120} />
        </div>
        <p style={hint}>
          Changing the address re-looks-up the map location. Delivery distance, driver
          dispatch and the pickup pin all use it.
        </p>
        <button onClick={saveShop} disabled={saving === 'shop'} style={primary}>
          {saving === 'shop' ? 'Saving…' : 'Save shop details'}
        </button>
      </section>

      <section style={cardBox}>
        <h2 style={h2}>Owner account</h2>
        {shop?.owner ? (
          <>
            <Field label="Owner name" value={of_.name} onChange={(v) => setOf({ ...of_, name: v })} />
            <Field label="Email" value={of_.email} onChange={(v) => setOf({ ...of_, email: v })} />
            <Field label="Phone" value={of_.phone} onChange={(v) => setOf({ ...of_, phone: v })} />
            <button onClick={() => saveOwner()} disabled={saving === 'owner'} style={primary}>
              {saving === 'owner' ? 'Saving…' : 'Save owner'}
            </button>

            <div style={{ borderTop: '1px solid #EEE', marginTop: 18, paddingTop: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 6px' }}>Set a new password</h3>
              <p style={hint}>
                Changes it immediately — the owner is not notified and any existing
                password stops working. Tell them what it is before you save.
              </p>
              <Field label="New password" value={pw} onChange={setPw} type="password" placeholder="At least 6 characters" />
              <button
                onClick={() => {
                  if (pw.length < 6) { setError('Password must be at least 6 characters.'); return }
                  if (confirm(`Change the password for ${of_.email}?\n\nTheir current password stops working straight away and they are not emailed about it.`)) {
                    saveOwner({ new_password: pw })
                  }
                }}
                disabled={saving === 'password' || pw.length === 0}
                style={{ ...primary, background: '#B42318' }}
              >
                {saving === 'password' ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Unclaimed — no owner account is linked to this shop yet, so there is nothing to edit.
            {' '}<Link href="/admin/claim-requests" style={{ color: '#6366F1' }}>Claim requests</Link>
          </p>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type, width }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; width?: number
}) {
  return (
    <label style={{ display: 'block', marginBottom: 10, flex: width ? '0 0 auto' : 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</span>
      <input
        value={value}
        type={type || 'text'}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: width ? width : '100%', padding: '9px 11px', borderRadius: 8,
          border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </label>
  )
}

const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 16 }
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: '0 0 12px' }
const primary: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 }
const back: React.CSSProperties = { background: 'none', border: 'none', color: '#6366F1', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }
const hint: React.CSSProperties = { fontSize: 12, color: '#6B7280', margin: '2px 0 10px', lineHeight: 1.5 }
const banner = (color: string, bg: string, border: string): React.CSSProperties => ({
  color, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14,
})
