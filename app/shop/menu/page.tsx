'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MenuItem } from '@/lib/types'

const CATEGORIES = ['all', 'donuts', 'coffee', 'breakfast', 'drinks', 'other']
const emptyItem = { name: '', description: '', price: '', category: 'donuts', image_url: '', images: [] as string[], is_available: true, is_featured: false }

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) return null
  const data = await res.json()
  return data.url
}

export default function ShopMenu() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editImages, setEditImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/shop/menu')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i])
      if (url) newUrls.push(url)
    }
    setEditImages(prev => [...prev, ...newUrls])
    // Set first image as main image_url if none set
    if (!editing?.image_url && newUrls.length > 0) {
      setEditing((prev: any) => ({ ...prev, image_url: newUrls[0] }))
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setEditImages(prev => {
      const updated = prev.filter((_, i) => i !== index)
      // If removed image was the main one, set new main
      if (editing?.image_url === prev[index]) {
        setEditing((e: any) => ({ ...e, image_url: updated[0] || '' }))
      }
      return updated
    })
  }

  const setMainImage = (url: string) => {
    setEditing((prev: any) => ({ ...prev, image_url: url }))
  }

  const saveItem = async () => {
    if (!editing?.name || !editing?.price) return
    const method = editing.id ? 'PUT' : 'POST'
    const mainImage = editing.image_url || editImages[0] || ''
    await fetch('/api/shop/menu', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editing, image_url: mainImage, images: editImages, price: parseFloat(editing.price) }),
    })
    setEditing(null)
    setShowForm(false)
    setEditImages([])
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

  const openAdd = () => {
    setEditing({ ...emptyItem })
    setEditImages([])
    setShowForm(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing({ ...item, price: item.price.toString() })
    setEditImages(item.images || (item.image_url ? [item.image_url] : []))
    setShowForm(true)
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
        <button onClick={openAdd} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>+ Add Item</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #FFE4EF', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing?.id ? 'Edit Item' : 'New Item'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Name</label><input style={inputStyle} value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Price ($)</label><input style={inputStyle} type="number" step="0.01" value={editing?.price || ''} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Description</label><input style={inputStyle} value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Category</label><select style={inputStyle} value={editing?.category || 'donuts'} onChange={e => setEditing({ ...editing, category: e.target.value })}>{CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_available ?? true} onChange={e => setEditing({ ...editing, is_available: e.target.checked })} /> Available</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_featured ?? false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} /> Featured</label>
            </div>
          </div>

          {/* Images Section */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 8 }}>Images</label>

            {editImages.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {editImages.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: 100, height: 100 }}>
                    <img src={url} alt={`Image ${i + 1}`} style={{
                      width: 100, height: 100, objectFit: 'cover', borderRadius: 8,
                      border: editing?.image_url === url ? '3px solid #FF1493' : '1px solid #ddd',
                      cursor: 'pointer',
                    }}
                      onClick={() => setMainImage(url)}
                      title="Click to set as main image"
                    />
                    {editing?.image_url === url && (
                      <span style={{
                        position: 'absolute', top: 4, left: 4,
                        background: '#FF1493', color: '#fff', fontSize: 9, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 4,
                      }}>MAIN</span>
                    )}
                    <button onClick={() => removeImage(i)} style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#DC2626', color: '#fff', border: 'none',
                      borderRadius: '50%', width: 20, height: 20, fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}>x</button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadImages}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: uploading ? '#ccc' : '#FF8C00', color: '#fff',
                border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Images'}
            </button>
            {editImages.length > 0 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                {editImages.length} image{editImages.length !== 1 ? 's' : ''} — click an image to set it as the main photo
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={saveItem} disabled={uploading} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: uploading ? '#ccc' : '#FF1493', color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>{uploading ? 'Uploading...' : 'Save'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); setEditImages([]) }} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#f5f5f5', color: '#666', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map(item => {
          const allImages = item.images || (item.image_url ? [item.image_url] : [])
          return (
            <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #FFE4EF', opacity: item.is_available ? 1 : 0.5 }}>
              {allImages.length > 0 && (
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <img src={item.image_url || allImages[0]} alt={item.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }} />
                  {allImages.length > 1 && (
                    <span style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 12,
                    }}>+{allImages.length - 1} more</span>
                  )}
                </div>
              )}
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
                  <button onClick={() => openEdit(item)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteItem(item.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
