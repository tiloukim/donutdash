'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SHOP_COMMISSION_RATE, MIN_COMMISSION_RATE, MAX_COMMISSION_RATE, SERVICE_FEE_RATE } from '@/lib/constants'

interface Shop {
  id: string
  shop_number: number
  name: string
  city: string
  is_active: boolean
  pos_enabled?: boolean
  rating: number
  review_count: number
  commission_pct: number
  service_fee_pct: number
  delivery_fee: number
  min_order: number
  tax_rate: number
  cash_discount_pct: number
  pricing_mode: 'standard' | 'cash_discount' | 'dual_pricing'
  created_at: string
  owner: { name: string; email: string } | null
}

const EDITABLE_FIELDS = ['commission_pct', 'service_fee_pct', 'tax_rate', 'cash_discount_pct', 'pricing_mode', 'delivery_fee', 'min_order'] as const

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([])
  const [originalShops, setOriginalShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [togglingPos, setTogglingPos] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newShop, setNewShop] = useState({
    name: '', address: '', city: '', state: 'TX', zip: '', phone: '',
    description: '', delivery_fee: '3.99', min_order: '10', tax_rate: '8.25',
    service_fee_pct: String(SERVICE_FEE_RATE * 100),
    commission_pct: String(SHOP_COMMISSION_RATE * 100),
    lat: '', lng: '',
  })

  useEffect(() => {
    fetch('/api/admin/shops')
      .then(r => r.json())
      .then(data => {
        const list = data.shops || []
        setShops(list)
        setOriginalShops(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dirtyShops = shops
    .map(s => {
      const orig = originalShops.find(o => o.id === s.id)
      if (!orig) return null
      const changes: Record<string, number | string> = {}
      for (const f of EDITABLE_FIELDS) {
        if (s[f] !== orig[f]) changes[f] = s[f] as number | string
      }
      return Object.keys(changes).length ? { id: s.id, name: s.name, changes } : null
    })
    .filter((x): x is { id: string; name: string; changes: Record<string, number | string> } => x !== null)

  const hasChanges = dirtyShops.length > 0

  const discardChanges = () => {
    setShops(originalShops)
    setSaveError('')
  }

  const saveAllChanges = async () => {
    setSavingAll(true)
    setSaveError('')
    const failures: string[] = []
    for (const d of dirtyShops) {
      try {
        const res = await fetch('/api/admin/shops', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: d.id, ...d.changes }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          failures.push(`${d.name}: ${body.error || res.statusText}`)
        }
      } catch {
        failures.push(`${d.name}: network error`)
      }
    }
    if (failures.length === 0) {
      setOriginalShops(shops)
    } else {
      setSaveError(failures.join(' • '))
      // Sync originals for shops that DID save successfully so the dirty
      // bar only shows the remaining failures.
      const failedIds = new Set(
        failures.map(f => dirtyShops.find(d => f.startsWith(d.name + ':'))?.id).filter(Boolean) as string[]
      )
      setOriginalShops(prev => shops.map(s => failedIds.has(s.id) ? (prev.find(o => o.id === s.id) ?? s) : s))
    }
    setSavingAll(false)
  }

  const toggleShop = async (id: string, currentActive: boolean) => {
    setToggling(id)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      if (res.ok) {
        setShops(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s))
        setOriginalShops(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s))
      }
    } catch { /* ignore */ }
    setToggling(null)
  }

  // POS entitlement — separate from is_active so a shop can be on delivery
  // but off POS (or vice-versa). Enforced server-side in authorizeForShop;
  // an undefined value (pre-migration) is treated as enabled.
  const togglePos = async (id: string, currentEnabled: boolean) => {
    setTogglingPos(id)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pos_enabled: !currentEnabled }),
      })
      if (res.ok) {
        setShops(prev => prev.map(s => s.id === id ? { ...s, pos_enabled: !currentEnabled } : s))
        setOriginalShops(prev => prev.map(s => s.id === id ? { ...s, pos_enabled: !currentEnabled } : s))
      } else {
        // Surface the failure instead of silently doing nothing (e.g. the
        // pos_enabled column not yet migrated returns a 500 here).
        const data = await res.json().catch(() => ({} as { error?: string }))
        alert(`Couldn't ${currentEnabled ? 'disable' : 'enable'} POS: ${data.error || res.statusText}`)
      }
    } catch {
      alert('Network error — could not update POS status.')
    }
    setTogglingPos(null)
  }

  const handleCreateShop = async () => {
    if (!newShop.name.trim() || !newShop.address.trim() || !newShop.city.trim() || !newShop.zip.trim()) {
      setCreateError('Name, address, city, and ZIP are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShop.name.trim(),
          address: newShop.address.trim(),
          city: newShop.city.trim(),
          state: newShop.state.trim(),
          zip: newShop.zip.trim(),
          phone: newShop.phone.trim(),
          description: newShop.description.trim(),
          delivery_fee: parseFloat(newShop.delivery_fee) || 3.99,
          min_order: parseFloat(newShop.min_order) || 10,
          tax_rate: parseFloat(newShop.tax_rate) || 8.25,
          service_fee_pct: parseFloat(newShop.service_fee_pct) || SERVICE_FEE_RATE * 100,
          commission_pct: parseFloat(newShop.commission_pct) || SHOP_COMMISSION_RATE * 100,
          lat: newShop.lat ? parseFloat(newShop.lat) : null,
          lng: newShop.lng ? parseFloat(newShop.lng) : null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const created = { ...data.shop, owner: null }
        setShops(prev => [created, ...prev])
        setOriginalShops(prev => [created, ...prev])
        setShowCreate(false)
        setNewShop({ name: '', address: '', city: '', state: 'TX', zip: '', phone: '', description: '', delivery_fee: '3.99', min_order: '10', tax_rate: '8.25', service_fee_pct: String(SERVICE_FEE_RATE * 100), commission_pct: String(SHOP_COMMISSION_RATE * 100), lat: '', lng: '' })
      } else {
        setCreateError(data.error || 'Failed to create shop')
      }
    } catch {
      setCreateError('Failed to create shop')
    }
    setCreating(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading shops...</div>

  const filteredShops = shops.filter(s => {
    if (!search) return true
    const q = search.toLowerCase().trim()
    // Allow searching the shop ID with or without a leading "#".
    const idQ = q.replace(/^#/, '')
    return (
      String(s.shop_number).includes(idQ) ||
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      (s.owner?.name || '').toLowerCase().includes(q)
    )
  })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search shops by ID (#1001), name, city, or owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid #ddd', fontSize: 14, outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#6366F1'}
          onBlur={e => e.currentTarget.style.borderColor = '#ddd'}
        />
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          + Add Shop
        </button>
      </div>

      {/* Create Shop Modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add New Shop</h3>
            {createError && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 14 }}>{createError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Shop Name *</label>
                <input style={inputStyle} placeholder="e.g. Happy Donuts" value={newShop.name} onChange={e => setNewShop(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Address *</label>
                <input style={inputStyle} placeholder="123 Main St" value={newShop.address} onChange={e => setNewShop(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>City *</label>
                  <input style={inputStyle} placeholder="Tyler" value={newShop.city} onChange={e => setNewShop(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>State</label>
                  <input style={inputStyle} placeholder="TX" value={newShop.state} onChange={e => setNewShop(p => ({ ...p, state: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ZIP *</label>
                  <input style={inputStyle} placeholder="75703" value={newShop.zip} onChange={e => setNewShop(p => ({ ...p, zip: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone</label>
                <input style={inputStyle} placeholder="(903) 555-1234" value={newShop.phone} onChange={e => setNewShop(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
                <input style={inputStyle} placeholder="Fresh donuts made daily" value={newShop.description} onChange={e => setNewShop(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Latitude</label>
                  <input style={inputStyle} placeholder="32.3513" value={newShop.lat} onChange={e => setNewShop(p => ({ ...p, lat: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Longitude</label>
                  <input style={inputStyle} placeholder="-95.3011" value={newShop.lng} onChange={e => setNewShop(p => ({ ...p, lng: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Delivery Fee</label>
                  <input style={inputStyle} type="number" step="0.50" value={newShop.delivery_fee} onChange={e => setNewShop(p => ({ ...p, delivery_fee: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Min Order</label>
                  <input style={inputStyle} type="number" step="1" value={newShop.min_order} onChange={e => setNewShop(p => ({ ...p, min_order: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tax %</label>
                  <input style={inputStyle} type="number" step="0.25" value={newShop.tax_rate} onChange={e => setNewShop(p => ({ ...p, tax_rate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Service Fee %</label>
                  <input style={inputStyle} type="number" step="0.5" value={newShop.service_fee_pct} onChange={e => setNewShop(p => ({ ...p, service_fee_pct: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Commission %</label>
                  <input style={inputStyle} type="number" step="0.5" min={MIN_COMMISSION_RATE * 100} max={MAX_COMMISSION_RATE * 100} value={newShop.commission_pct} onChange={e => setNewShop(p => ({ ...p, commission_pct: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleCreateShop} disabled={creating}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: creating ? '#ccc' : '#6366F1', color: '#fff', fontSize: 15, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : 'Create Shop'}
              </button>
              <button onClick={() => { setShowCreate(false); setCreateError('') }}
                style={{ padding: '12px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['ID', 'Shop', 'Owner', 'City', 'Commission %', 'Service Fee %', 'Tax Rate %', 'Cash Discount %', 'Pricing Mode', 'Delivery Fee', 'Min Order', 'Rating', 'Status', 'Actions', 'Pitch'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredShops.map(shop => {
                const isDirty = dirtyShops.some(d => d.id === shop.id)
                return (
                <tr key={shop.id} style={{ borderBottom: '1px solid #F3F4F6', background: isDirty ? '#FFFBEB' : undefined }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#6366F1', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    #{shop.shop_number}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>
                    {shop.name}
                    {isDirty && <span style={{ marginLeft: 6, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} title="Unsaved changes" />}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{shop.owner?.name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{shop.city}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.5" min={MIN_COMMISSION_RATE * 100} max={MAX_COMMISSION_RATE * 100} value={shop.commission_pct ?? SHOP_COMMISSION_RATE * 100}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, commission_pct: parseFloat(e.target.value) || 0 } : s))}
                      title={`Allowed range: ${MIN_COMMISSION_RATE * 100}% – ${MAX_COMMISSION_RATE * 100}%`}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.5" min="0" max="50" value={shop.service_fee_pct}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, service_fee_pct: parseFloat(e.target.value) || 0 } : s))}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.25" min="0" max="15" value={shop.tax_rate}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, tax_rate: parseFloat(e.target.value) || 0 } : s))}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.25" min="0" max="10" value={shop.cash_discount_pct ?? 0}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, cash_discount_pct: parseFloat(e.target.value) || 0 } : s))}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                      title="0 = feature off. Set e.g. 3 to give a 3% cash discount at the POS."
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={shop.pricing_mode ?? 'standard'}
                      onChange={e => {
                        const next = e.target.value as Shop['pricing_mode']
                        setShops(prev => prev.map(s => s.id === shop.id ? { ...s, pricing_mode: next } : s))
                      }}
                      style={{ padding: '4px 6px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, background: '#fff', cursor: 'pointer' }}
                      title="standard = no popup. cash_discount = popup at checkout. dual_pricing = both prices on every menu item upfront."
                    >
                      <option value="standard">standard</option>
                      <option value="cash_discount">cash_discount</option>
                      <option value="dual_pricing">dual_pricing</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    $<input type="number" step="0.50" min="0" value={shop.delivery_fee}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, delivery_fee: parseFloat(e.target.value) || 0 } : s))}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    $<input type="number" step="1" min="0" value={shop.min_order}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, min_order: parseFloat(e.target.value) || 0 } : s))}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>⭐ {shop.rating} ({shop.review_count})</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: shop.is_active ? '#D1FAE5' : '#FEE2E2',
                      color: shop.is_active ? '#065F46' : '#991B1B',
                    }}>
                      {shop.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleShop(shop.id, shop.is_active)}
                      disabled={toggling === shop.id}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: shop.is_active ? '#FEF2F2' : '#F0FDF4',
                        color: shop.is_active ? '#DC2626' : '#16A34A',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        opacity: toggling === shop.id ? 0.5 : 1,
                      }}
                    >
                      {shop.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    {(() => {
                      const posOn = shop.pos_enabled !== false
                      return (
                        <button
                          onClick={() => togglePos(shop.id, posOn)}
                          disabled={togglingPos === shop.id}
                          title={posOn ? 'Disable the in-store POS for this shop' : 'Enable the in-store POS for this shop'}
                          style={{
                            marginLeft: 8,
                            padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
                            background: posOn ? '#FEF2F2' : '#F0FDF4',
                            color: posOn ? '#DC2626' : '#16A34A',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            opacity: togglingPos === shop.id ? 0.5 : 1,
                          }}
                        >
                          {posOn ? 'Disable POS' : 'Enable POS'}
                        </button>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/admin/shops/${shop.id}/pitch`}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: '#EEF2FF', color: '#4F46E5',
                        textDecoration: 'none', fontSize: 13, fontWeight: 600,
                        display: 'inline-block',
                      }}
                    >
                      Pitch →
                    </Link>
                  </td>
                </tr>
                )
              })}
              {shops.length === 0 && (
                <tr><td colSpan={14} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No shops found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasChanges && (
        <div style={{
          position: 'sticky', bottom: 16, marginTop: 16, zIndex: 50,
          background: '#111827', color: '#fff', borderRadius: 12,
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
        }}>
          <div style={{ flex: 1, fontSize: 14 }}>
            <strong>{dirtyShops.length}</strong> shop{dirtyShops.length === 1 ? '' : 's'} with unsaved changes
            {saveError && <div style={{ marginTop: 4, color: '#FCA5A5', fontSize: 12 }}>{saveError}</div>}
          </div>
          <button
            onClick={discardChanges}
            disabled={savingAll}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #4B5563',
              background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: savingAll ? 'not-allowed' : 'pointer', opacity: savingAll ? 0.5 : 1,
            }}
          >
            Discard
          </button>
          <button
            onClick={saveAllChanges}
            disabled={savingAll}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: savingAll ? '#6B7280' : '#10B981', color: '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: savingAll ? 'not-allowed' : 'pointer',
            }}
          >
            {savingAll ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
