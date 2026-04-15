'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MenuItem, VariantGroup } from '@/lib/types'
import { compressImage } from '@/lib/compress-image'
import { useShopLang } from '@/lib/shop-lang-context'

interface VariantFormOption { name: string; price: string }
interface VariantFormGroup { name: string; options: VariantFormOption[] }

function SortableMenuItem({ item, onEdit, onDelete, onToggle, onToggleSoldOut }: {
  item: MenuItem
  onEdit: (item: MenuItem) => void
  onDelete: (id: string) => void
  onToggle: (item: MenuItem) => void
  onToggleSoldOut: (item: MenuItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const isSoldOut = item.is_sold_out ?? false
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (!item.is_available || isSoldOut) ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  const allImages = (item.images && item.images.length > 0) ? item.images : (item.image_url ? [item.image_url] : [])

  return (
    <div ref={setNodeRef} style={{ ...style, background: '#fff', borderRadius: 10, padding: 10, border: isDragging ? '2px solid #FF1493' : '1px solid #FFE4EF', fontSize: 12, cursor: 'grab' }} {...attributes} {...listeners}>
      {allImages.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <img src={item.image_url || allImages[0]} alt={item.name} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, pointerEvents: 'none' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>{item.name}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'capitalize' }}>{item.category}</div>
        </div>
        <div style={{ fontWeight: 700, color: '#10B981', fontSize: 12 }}>${item.price.toFixed(2)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onPointerDown={e => e.stopPropagation()} onClick={() => onToggle(item)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', background: item.is_available ? '#D1FAE5' : '#FEE2E2', color: item.is_available ? '#065F46' : '#DC2626', cursor: 'pointer', fontWeight: 600 }}>
            {item.is_available ? 'On' : 'Off'}
          </button>
          <button onPointerDown={e => e.stopPropagation()} onClick={() => onToggleSoldOut(item)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', background: isSoldOut ? '#FEF3C7' : '#f9f9f9', color: isSoldOut ? '#92400E' : '#888', cursor: 'pointer', fontWeight: 600 }}>
            {isSoldOut ? 'Sold Out' : 'In Stock'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(item)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}>Edit</button>
          <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(item.id)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #FECACA', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer' }}>Del</button>
        </div>
      </div>
    </div>
  )
}

const CATEGORIES = ['all', 'donuts', 'coffee', 'breakfast', 'drinks', 'other']
const emptyItem = { name: '', description: '', price: '', category: 'donuts', image_url: '', images: [] as string[], is_available: true, is_featured: false }

async function uploadImage(file: File): Promise<string | null> {
  const compressed = await compressImage(file)
  const formData = new FormData()
  formData.append('file', compressed)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) return null
  const data = await res.json()
  return data.url
}

export default function ShopMenu() {
  const { t } = useShopLang()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editImages, setEditImages] = useState<string[]>([])
  const [editVariants, setEditVariants] = useState<VariantFormGroup[]>([])
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
    const variants: VariantGroup[] | null = editVariants
      .filter(v => v.name.trim() && v.options.length > 0)
      .map(v => ({
        name: v.name.trim(),
        options: v.options.filter(o => o.name.trim()).map(o => ({ name: o.name.trim(), price: parseFloat(o.price) || 0 })),
      }))
      .filter(v => v.options.length > 0)
    await fetch('/api/shop/menu', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editing, image_url: mainImage, images: editImages, price: parseFloat(editing.price), variants: variants.length > 0 ? variants : null }),
    })
    setEditing(null)
    setShowForm(false)
    setEditImages([])
    setEditVariants([])
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

  const toggleSoldOut = async (item: MenuItem) => {
    await fetch('/api/shop/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_sold_out: !(item.is_sold_out ?? false) }) })
    fetchItems()
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = filtered.findIndex(i => i.id === active.id)
    const newIndex = filtered.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic reorder
    const reordered = arrayMove(filtered, oldIndex, newIndex)
    setItems(prev => {
      const otherItems = prev.filter(i => !reordered.find(r => r.id === i.id))
      return [...otherItems, ...reordered]
    })

    // Save new sort_order for all reordered items
    await Promise.all(
      reordered.map((item, idx) =>
        fetch('/api/shop/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, sort_order: idx }),
        })
      )
    )
    fetchItems()
  }

  const openAdd = () => {
    setEditing({ ...emptyItem })
    setEditImages([])
    setEditVariants([])
    setShowForm(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing({ ...item, price: item.price.toString() })
    setEditImages((item.images && item.images.length > 0) ? item.images : (item.image_url ? [item.image_url] : []))
    setEditVariants(item.variants?.map(v => ({
      name: v.name,
      options: v.options.map(o => ({ name: typeof o === 'string' ? o : o.name, price: typeof o === 'object' ? o.price.toString() : '' }))
    })) || [])
    setShowForm(true)
  }

  const [loadingTemplate, setLoadingTemplate] = useState(false)

  const loadTemplate = async () => {
    if (!confirm('Load the starter menu template? This will add ~25 common donut shop items (donuts, coffee, breakfast, drinks) that you can customize.')) return
    setLoadingTemplate(true)
    try {
      const res = await fetch('/api/shop/menu/template', { method: 'POST' })
      if (res.ok) {
        fetchItems()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to load template')
      }
    } catch {
      alert('Failed to load template')
    }
    setLoadingTemplate(false)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #FFD6E8', borderRadius: 8, fontSize: 14 } as const

  if (loading) return <div>{t('common.loading')}</div>

  return (
    <div>
      {items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFF0F5', borderRadius: 16, marginBottom: 24, border: '2px dashed #FFD6E8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#127849;</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#333' }}>{t('menu.emptyTitle')}</h3>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            {t('menu.emptyDesc')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={loadTemplate}
              disabled={loadingTemplate}
              style={{ padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: loadingTemplate ? '#ccc' : '#FF1493', color: '#fff', border: 'none', cursor: loadingTemplate ? 'not-allowed' : 'pointer' }}
            >
              {loadingTemplate ? t('common.loading') : t('menu.loadStarter')}
            </button>
            <button onClick={openAdd} style={{ padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#fff', color: '#FF1493', border: '2px solid #FF1493', cursor: 'pointer' }}>
              {t('menu.fromScratch')}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === c ? '#FF1493' : '#FFF0F5', color: filter === c ? '#fff' : '#888', textTransform: 'capitalize',
            }}>{c}</button>
          ))}
        </div>
        <button onClick={openAdd} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{t('menu.addItem')}</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 12px', border: '1px solid #FFE4EF', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing?.id ? t('menu.editItem') : t('menu.newItem')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.name')}</label><input style={inputStyle} value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.price')}</label><input style={inputStyle} type="number" step="0.01" value={editing?.price || ''} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.description')}</label><input style={inputStyle} value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.category')}</label><select style={inputStyle} value={editing?.category || 'donuts'} onChange={e => setEditing({ ...editing, category: e.target.value })}>{CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.prepTime')}</label><input style={inputStyle} type="number" min="0" placeholder="e.g. 5" value={editing?.prep_time_min ?? ''} onChange={e => setEditing({ ...editing, prep_time_min: e.target.value ? parseInt(e.target.value) : null })} /></div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_available ?? true} onChange={e => setEditing({ ...editing, is_available: e.target.checked })} /> {t('menu.available')}</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editing?.is_featured ?? false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} /> {t('menu.featured')}</label>
            </div>
          </div>

          {/* Variants Section */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.variants')}</label>
              <button type="button" onClick={() => setEditVariants(prev => [...prev, { name: '', options: [{ name: '', price: '' }] }])} style={{ fontSize: 11, color: '#FF1493', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>{t('menu.addVariantGroup')}</button>
            </div>
            {editVariants.map((group, gi) => (
              <div key={gi} style={{ border: '1px solid #FFD6E8', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input placeholder="Group name (e.g. Size)" value={group.name} onChange={e => { const v = [...editVariants]; v[gi].name = e.target.value; setEditVariants(v) }} style={{ flex: 1, padding: '6px 10px', border: '1px solid #FFD6E8', borderRadius: 6, fontSize: 13 }} />
                  <button type="button" onClick={() => setEditVariants(prev => prev.filter((_, i) => i !== gi))} style={{ color: '#DC2626', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                </div>
                {group.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, marginLeft: 16 }}>
                    <input placeholder="Option name" value={opt.name} onChange={e => { const v = [...editVariants]; v[gi].options[oi].name = e.target.value; setEditVariants(v) }} style={{ flex: 1, padding: '4px 8px', border: '1px solid #eee', borderRadius: 4, fontSize: 12 }} />
                    <span style={{ fontSize: 12, color: '#888' }}>$</span>
                    <input placeholder="0.00" type="number" step="0.01" value={opt.price} onChange={e => { const v = [...editVariants]; v[gi].options[oi].price = e.target.value; setEditVariants(v) }} style={{ width: 70, padding: '4px 8px', border: '1px solid #eee', borderRadius: 4, fontSize: 12 }} />
                    <button type="button" onClick={() => { const v = [...editVariants]; v[gi].options = v[gi].options.filter((_, i) => i !== oi); setEditVariants(v) }} style={{ color: '#DC2626', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => { const v = [...editVariants]; v[gi].options.push({ name: '', price: '' }); setEditVariants(v) }} style={{ fontSize: 11, color: '#FF1493', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 16, marginTop: 4 }}>{t('menu.addOption')}</button>
              </div>
            ))}
          </div>

          {/* Images Section */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 8 }}>{t('menu.images')}</label>

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
              {uploading ? t('menu.uploading') : t('menu.uploadImages')}
            </button>
            {editImages.length > 0 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                {editImages.length} image{editImages.length !== 1 ? 's' : ''} — click an image to set it as the main photo
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={saveItem} disabled={uploading} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: uploading ? '#ccc' : '#FF1493', color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>{uploading ? t('menu.uploading') : t('menu.save')}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); setEditImages([]) }} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#f5f5f5', color: '#666', border: 'none', cursor: 'pointer' }}>{t('menu.cancel')}</button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {filtered.map(item => (
              <SortableMenuItem key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onToggle={toggleAvailable} onToggleSoldOut={toggleSoldOut} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
