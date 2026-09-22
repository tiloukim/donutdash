'use client'

import { useEffect, useState } from 'react'

/**
 * Connect this shop's own Square account.
 *
 * The shop's register lives in the shop's Square, not DonutDash's — those
 * are separate sellers — so the platform needs the shop's own credentials
 * before it can show a Square figure that means anything.
 *
 * The token is sent once, stored encrypted, and never comes back. This
 * screen only ever learns whether one is stored and which location it
 * points at.
 */

interface Loc { id: string; name: string; status?: string; city?: string }

interface Status {
  connected: boolean
  locationId: string | null
  locationName: string | null
  connectedAt: string | null
  keyConfigured: boolean
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 20, marginTop: 20,
}
const input: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, width: '100%',
}
const btn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: '#FF1493', color: '#fff',
  fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14,
}

export default function SquareConnect() {
  const [status, setStatus] = useState<Status | null>(null)
  const [token, setToken] = useState('')
  const [locations, setLocations] = useState<Loc[] | null>(null)
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function load() {
    const res = await fetch('/api/shop/square-connect')
    if (res.ok) setStatus(await res.json())
  }
  useEffect(() => { void load() }, [])

  async function connect(locationId?: string) {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await fetch('/api/shop/square-connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, ...(locationId ? { locationId } : {}) }),
      })
      const data = await res.json()
      // 409 is not a failure: the token works and Square has more than one
      // location, so which till is this shop is a question only the owner
      // can answer.
      if (res.status === 409 && data.needsLocation) {
        setLocations(data.locations)
        setChosen(data.locations?.[0]?.id ?? '')
        return
      }
      if (!res.ok) throw new Error(data?.error ?? 'Could not connect.')
      setToken(''); setLocations(null)
      setNote(`Connected to ${data.locationName}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await fetch('/api/shop/square-connect', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not disconnect.')
      setNote(data.note ?? 'Disconnected.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect.')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  return (
    <div style={card}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Square register</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>
        If this shop also rings sales on a Square terminal, connect that Square account and
        Walk-in Sales will show both registers side by side.
      </p>

      {!status.keyConfigured && (
        <p style={{ fontSize: 13, color: '#B42318', background: '#FFF6F6', border: '1px solid #F3C2C2', borderRadius: 8, padding: 12 }}>
          The server has no encryption key set, so a token can’t be stored safely yet.
          Ask DonutDash to set <code>SQUARE_CREDENTIALS_KEY</code>.
        </p>
      )}

      {status.connected ? (
        <>
          <div style={{ background: '#F4FBF6', border: '1px solid #CFEBD9', borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Connected · {status.locationName}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Location {status.locationId}
              {status.connectedAt ? ` · since ${new Date(status.connectedAt).toLocaleDateString()}` : ''}
            </div>
          </div>
          <button onClick={() => void disconnect()} disabled={busy}
            style={{ ...btn, background: '#fff', color: '#B42318', border: '1px solid #F3C2C2', marginTop: 12 }}>
            {busy ? 'Working…' : 'Disconnect'}
          </button>
        </>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Square production access token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAA…"
            style={input}
            autoComplete="off"
            disabled={busy || !status.keyConfigured}
          />
          {/* Said plainly rather than buried. This token is the merchant's
              whole Square account, and anyone pasting one should know that
              before they do it, not after. */}
          <p style={{ fontSize: 12, color: '#8A6D3B', background: '#FFF9E8', border: '1px solid #F2E2B5', borderRadius: 8, padding: 10, marginTop: 10, lineHeight: 1.5 }}>
            This token grants full access to your Square account. DonutDash stores it encrypted
            and uses it only to read payments, but treat it like a password — and rotate it in
            your Square dashboard if you ever disconnect.
          </p>

          {locations && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Which location is this shop’s register?
              </label>
              <select value={chosen} onChange={(e) => setChosen(e.target.value)} style={input}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.city ? ` · ${l.city}` : ''}{l.status === 'INACTIVE' ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => void connect(locations ? chosen : undefined)}
            disabled={busy || !token.trim() || !status.keyConfigured}
            style={{ ...btn, marginTop: 12, opacity: busy || !token.trim() ? 0.5 : 1 }}
          >
            {busy ? 'Checking with Square…' : locations ? 'Use this location' : 'Connect Square'}
          </button>
        </>
      )}

      {error && <p style={{ color: '#B42318', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {note && <p style={{ color: '#1A7F4B', fontSize: 13, marginTop: 10 }}>{note}</p>}
    </div>
  )
}
