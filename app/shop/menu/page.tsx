'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MenuItem } from '@/lib/types'

const CATEGORIES = ['all', 'donuts', 'coffee', 'breakfast', 'drinks', 'other']
const emptyItem = { name: '', description: '', price: '', category: 'donuts', image_url: '', is_available: true, is_featured: false }

export default function ShopMenu() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/shop/menu')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const saveItem = async () => {
    if (!editing?.name || !editing?.price) return
    const method = editing.id ? 'PUT' : 'POST'
    await fetch('/api/shop/menu', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, price: parseFloat(editing.price) }) })
    setEditing(null)
    setShowForm(false)
    fetchItems()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return
    await fetch('/api/shop/menu', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchItems()
  }

  const toggleAvailable = async (item: MenuItem) => {
    await fetch('/api/shop/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_available: !item.is_available }) })
    fetchItems()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #FFD6E8', borderRadius: 8, fontSize: 14 } as const

  if (loading) return <div>Loading menu...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === c ? '#FF1493' : '#FFF0F5', color: filter === c ? '#fff' : '#888', textTransform: 'capitalize',
            }}>{c}</button>
          ))}
        </div>
        <button onClick={() => { setEditing({ ...emptyItem }); setShowForm(true) }} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>+ Add Item</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #FFE4EF', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing?.id ? 'Edit Item' : 'New Item'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Name</label><input style={inputStyle} value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Price ($)</label><input style={inputStyle} type="number" step="0.01" value={editing?.price || ''} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Description</label><input style={inputStyle} value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Category</label><select style={inputStyle} value={editing?.category || 'donuts'} onChange={e => setEditing({ ...editing, category: e.target.value })}>{CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Image URL</label><input style={inputStyle} value={editing?.image_url || ''} onChange={e => setEditing({ ...editing, image_url: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_available ?? true} onChange={e => setEditing({ ...editing, is_available: e.target.checked })} /> Available</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_featured ?? false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} /> Featured</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={saveItem} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#f5f5f5', color: '#666', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map(item => (
          <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #FFE4EF', opacity: item.is_available ? 1 : 0.5 }}>
            {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>{item.category}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#10B981' }}>${item.price.toFixed(2)}</div>
            </div>
            {item.description && <p style={{ fontSize: 12, color: '#666', margin: '6px 0' }}>{item.description}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button onClick={() => toggleAvailable(item)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: item.is_available ? '#D1FAE5' : '#FEE2E2', color: item.is_available ? '#065F46' : '#DC2626', cursor: 'pointer', fontWeight: 600 }}>
                {item.is_available ? 'Available' : 'Unavailable'}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditing({ ...item, price: item.price.toString() }); setShowForm(true) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => deleteItem(item.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
