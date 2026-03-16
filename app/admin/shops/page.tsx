'use client'

import { useEffect, useState } from 'react'

interface Shop {
  id: string
  name: string
  city: string
  is_active: boolean
  rating: number
  review_count: number
  service_fee_pct: number
  delivery_fee: number
  min_order: number
  tax_rate: number
  created_at: string
  owner: { name: string; email: string } | null
}

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/shops')
      .then(r => r.json())
      .then(data => setShops(data.shops || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
      }
    } catch { /* ignore */ }
    setToggling(null)
  }

  const updateShopField = async (id: string, field: string, value: number) => {
    setSaving(id)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      })
      if (res.ok) {
        setShops(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
      }
    } catch { /* ignore */ }
    setSaving(null)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading shops...</div>

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Shop', 'Owner', 'City', 'Commission %', 'Tax Rate %', 'Delivery Fee', 'Min Order', 'Rating', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{shop.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{shop.owner?.name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{shop.city}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.5" min="0" max="50" value={shop.service_fee_pct}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, service_fee_pct: parseFloat(e.target.value) || 0 } : s))}
                      onBlur={e => updateShopField(shop.id, 'service_fee_pct', parseFloat(e.target.value) || 0)}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="number" step="0.25" min="0" max="15" value={shop.tax_rate}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, tax_rate: parseFloat(e.target.value) || 0 } : s))}
                      onBlur={e => updateShopField(shop.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    $<input type="number" step="0.50" min="0" value={shop.delivery_fee}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, delivery_fee: parseFloat(e.target.value) || 0 } : s))}
                      onBlur={e => updateShopField(shop.id, 'delivery_fee', parseFloat(e.target.value) || 0)}
                      style={{ width: 65, padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    $<input type="number" step="1" min="0" value={shop.min_order}
                      onChange={e => setShops(prev => prev.map(s => s.id === shop.id ? { ...s, min_order: parseFloat(e.target.value) || 0 } : s))}
                      onBlur={e => updateShopField(shop.id, 'min_order', parseFloat(e.target.value) || 0)}
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
                  </td>
                </tr>
              ))}
              {shops.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No shops found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
