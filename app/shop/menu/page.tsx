'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MenuItem, VariantGroup } from '@/lib/types'
import { compressImage } from '@/lib/compress-image'
import { useShopLang } from '@/lib/shop-lang-context'

interface VariantFormOption { name: string; price: string; online_price?: string }
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
const emptyItem = { name: '', description: '', price: '', online_price: '', category: 'donuts', image_url: '', images: [] as string[], is_available: true, is_featured: false }

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
  // What the item looked like when it was opened. Needed to tell an option
  // the owner edited from one they left alone — only the untouched ones
  // should follow a change to the item's price.
  const [orig, setOrig] = useState<{ price: string; online: string; opts: Record<string, { price: string; online: string }> } | null>(null)
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
    // An option's price is more specific than the item's, so it wins on both
    // the register and the site. Changing the item's price alone therefore
    // reached neither for an item with options — which is how the web could
    // say $7.75 while the till charged $8.03, and how twelve online prices
    // set on the register changed nothing a customer saw.
    //
    // So a change to the item's price shifts every option by the same
    // DIFFERENCE. An option the owner edited in this session keeps their
    // figure: an explicit edit outranks a derived one.
    //
    // The difference, not a ratio: "online costs $0.15 more" is the model
    // this shop uses, and it matches what the register does on save. A ratio
    // lives in the bulk tool, which can preview every option first.
    const num = (v: string | undefined) => {
      const n = parseFloat((v ?? '').trim())
      return Number.isFinite(n) ? n : null
    }
    const newPos = num(editing.price)
    const origPos = orig ? num(orig.price) : null
    const posDelta = newPos != null && origPos != null ? Math.round((newPos - origPos) * 100) / 100 : 0
    const newOnline = num(editing.online_price?.toString())
    const origOnline = orig ? num(orig.online) : null
    const onlineDelta =
      newOnline != null && origOnline != null ? Math.round((newOnline - origOnline) * 100) / 100 : null

    const variants: VariantGroup[] | null = editVariants
      .filter(v => v.name.trim() && v.options.length > 0)
      .map(v => ({
        name: v.name.trim(),
        options: v.options.filter(o => o.name.trim()).map(o => {
          const snap = orig?.opts[optKey(v.name.trim(), o.name.trim())]
          const untouchedPrice = !!snap && (o.price ?? '').trim() === snap.price
          const untouchedOnline = !!snap && (o.online_price ?? '').trim() === snap.online

          let price = parseFloat(o.price) || 0
          if (untouchedPrice && posDelta !== 0 && price > 0) {
            price = Math.max(0, Math.round((price + posDelta) * 100) / 100)
          }

          // Blank online price is stored as null, not 0 — null means "same as
          // counter" while 0 would read as free.
          let online = num(o.online_price)
          if (untouchedOnline && onlineDelta != null && onlineDelta !== 0) {
            // An option with no online price of its own was inheriting the
            // item; give it one anchored to its own counter price so a dozen
            // doesn't inherit a single donut's figure.
            const base = online ?? (parseFloat(o.price) || 0)
            if (base > 0) online = Math.max(0, Math.round((base + onlineDelta) * 100) / 100)
          }

          return {
            name: o.name.trim(),
            price,
            online_price: online != null && online > 0 ? online : null,
          }
        }),
      }))
      .filter(v => v.options.length > 0)
    await fetch('/api/shop/menu', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editing,
        image_url: mainImage,
        images: editImages,
        price: parseFloat(editing.price),
        // The register reads pos_price and only falls back to price when it
        // is null — and it is null nowhere on this menu. Writing `price`
        // alone therefore edited a number the till never reads: the web said
        // $7.75 for Half Dozen Chocolate while the counter charged $8.03.
        // Both are written together, exactly as the POS's own editor does.
        pos_price: parseFloat(editing.price),
        // Same rule as options: blank means "same as counter".
        online_price: editing.online_price?.toString().trim()
          ? parseFloat(editing.online_price) || null
          : null,
        variants: variants.length > 0 ? variants : null,
      }),
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

    // Reorder within the dragged item's own category, not across the whole
    // filtered list. With the page grouped into sections, indexing into
    // `filtered` mixed categories together: dropping a drink two tiles left
    // renumbered donuts, and the sort_order written back described a list
    // nobody was looking at.
    const dragged = items.find(i => i.id === active.id)
    if (!dragged) return
    const scope = filter === 'all'
      ? items.filter(i => i.category === dragged.category)
      : filtered

    const oldIndex = scope.findIndex(i => i.id === active.id)
    const newIndex = scope.findIndex(i => i.id === over.id)
    // A drop outside the dragged item's own category lands here. Doing
    // nothing is right: the tile's category is what decides where it
    // belongs, and that is changed by editing the item, not by dragging.
    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic reorder
    const reordered = arrayMove(scope, oldIndex, newIndex)
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

  /** Scale every option's prices by the same ratio the item's prices imply.
   *
   *  An owner who changes the item's online price from $1.25 to $1.30 means
   *  "4% more online", not "$1.30 for a dozen" — so the ratio is applied
   *  rather than the figure. Options with no counter price of their own are
   *  left alone; they already inherit the item.
   *
   *  Fills the visible fields rather than saving, so the result can be read
   *  and adjusted before it becomes what customers pay. */
  const applyItemPricesToOptions = () => {
    const counter = parseFloat(editing?.price)
    const online = editing?.online_price?.toString().trim()
      ? parseFloat(editing.online_price)
      : NaN
    if (!Number.isFinite(counter) || counter <= 0) return
    const ratio = Number.isFinite(online) && online > 0 ? online / counter : null
    setEditVariants(editVariants.map(g => ({
      ...g,
      options: g.options.map(o => {
        const optCounter = parseFloat(o.price)
        if (!Number.isFinite(optCounter) || optCounter <= 0) return o
        return {
          ...o,
          // Blank online ratio means "online matches counter" — clear the
          // option's online price rather than writing the counter figure
          // into it, so it keeps inheriting.
          online_price: ratio == null ? '' : (Math.round(optCounter * ratio * 100) / 100).toFixed(2),
        }
      }),
    })))
  }

  const openAdd = () => {
    // Nothing to compare against on a new item, so nothing propagates.
    setOrig(null)
    setEditing({ ...emptyItem })
    setEditImages([])
    setEditVariants([])
    setShowForm(true)
  }

  /** Key an option by group+name so a rename reads as a new option rather
   *  than silently inheriting the old one's delta. */
  const optKey = (g: string, o: string) => `${g}\u0000${o}`

  const openEdit = (item: MenuItem) => {
    // pos_price is what the register actually charges, so it is what the
    // form must show — otherwise an owner edits a price that is already
    // being overridden and sees no change at the till.
    setEditing({
      ...item,
      price: String(item.pos_price ?? item.price),
      online_price: item.online_price != null ? String(item.online_price) : '',
    })
    setEditImages((item.images && item.images.length > 0) ? item.images : (item.image_url ? [item.image_url] : []))
    setEditVariants(item.variants?.map(v => ({
      name: v.name,
      options: v.options.map(o => ({
        name: typeof o === 'string' ? o : o.name,
        price: typeof o === 'object' ? o.price.toString() : '',
        online_price: typeof o === 'object' && o.online_price != null ? String(o.online_price) : '',
      }))
    })) || [])
    setOrig({
      price: String(item.pos_price ?? item.price),
      online: item.online_price != null ? String(item.online_price) : '',
      opts: Object.fromEntries(
        (item.variants ?? []).flatMap(v => v.options.map(o => [
          optKey(v.name, typeof o === 'string' ? o : o.name),
          {
            price: typeof o === 'object' ? String(o.price) : '',
            online: typeof o === 'object' && o.online_price != null ? String(o.online_price) : '',
          },
        ])),
      ),
    })
    setShowForm(true)
  }

  type TemplateOption = { id: string; name: string; description: string; item_count: number }
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/shop/menu/template')
      .then(r => r.json())
      .then(data => { if (data?.templates) setTemplates(data.templates) })
      .catch(() => {})
  }, [])

  // Bulk price update
  type BulkOptionChange = { group: string; name: string; old_price: number; new_price: number }
  type BulkChange = {
    id: string; name: string; category: string
    old_price: number; new_price: number
    /** Variant options repriced alongside the item. */
    options?: BulkOptionChange[]
  }
  const [showBulk, setShowBulk] = useState(false)
  const [bulkMode, setBulkMode] = useState<'flat' | 'percent' | 'amount'>('percent')
  // Which price column to write. 'online' derives from the counter price, so
  // an owner sets counter prices once and says "online is that plus 20%".
  const [bulkTarget, setBulkTarget] = useState<'counter' | 'online'>('counter')
  const [bulkRound, setBulkRound] = useState('0')
  const [bulkVariants, setBulkVariants] = useState(true)
  const [bulkValue, setBulkValue] = useState('')
  const [bulkCategory, setBulkCategory] = useState<string>('all')
  const [bulkPreview, setBulkPreview] = useState<BulkChange[] | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const resetBulk = () => {
    setShowBulk(false)
    setBulkPreview(null)
    setBulkValue('')
    setBulkCategory('all')
    setBulkMode('percent')
    setBulkError('')
  }

  const runBulk = async (preview: boolean) => {
    const value = parseFloat(bulkValue)
    if (!Number.isFinite(value)) { setBulkError('Enter a number'); return }
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await fetch('/api/shop/menu/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: bulkMode, value, category: bulkCategory, preview,
          target: bulkTarget,
          round_to: Number(bulkRound) || 0,
          include_variants: bulkVariants,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setBulkError(data.error || 'Failed'); return }
      if (preview) {
        setBulkPreview(data.changes || [])
      } else {
        await fetchItems()
        resetBulk()
        alert(`Updated ${data.updated} item${data.updated === 1 ? '' : 's'}.`)
      }
    } catch {
      setBulkError('Network error')
    } finally {
      setBulkBusy(false)
    }
  }

  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const callTemplateApi = async (templateId: string, replace: boolean, restoreMode?: 'restore' | 'fresh') => {
    return fetch('/api/shop/menu/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, replace, ...(restoreMode ? { restore_mode: restoreMode } : {}) }),
    })
  }

  const loadTemplate = async (templateId: string, templateName: string, itemCount: number) => {
    const isReplacing = items.length > 0
    const intro = isReplacing
      ? `⚠️ Switching to "${templateName}" will replace your current menu.\n\nYour current menu will be saved as a snapshot you can restore later by switching back. Continue?`
      : `Load "${templateName}"? This will add ${itemCount} items (price $0, hidden by default) that you can customize.`
    if (!confirm(intro)) return

    setLoadingTemplate(templateId)
    try {
      let res = await callTemplateApi(templateId, isReplacing)

      // If a saved snapshot for the target template exists, the API returns
      // 409 with snapshot info; ask the user which to do then retry.
      if (res.status === 409) {
        const data = await res.clone().json()
        if (data?.snapshot_available) {
          const savedDate = data.saved_at ? new Date(data.saved_at).toLocaleDateString() : ''
          const restore = confirm(
            `You have a saved version of "${templateName}" from ${savedDate} (${data.item_count} items).\n\n` +
            `Click OK to RESTORE your previous setup.\n` +
            `Click Cancel to start FRESH from the template.`
          )
          res = await callTemplateApi(templateId, isReplacing, restore ? 'restore' : 'fresh')
        }
      }

      if (res.ok) {
        const data = await res.json()
        await fetchItems()
        setShowTemplatePicker(false)
        if (data.restored) {
          alert(`Restored your previous "${templateName}" setup (${data.count} items).`)
        }
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to load template')
      }
    } catch {
      alert('Failed to load template')
    }
    setLoadingTemplate(null)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)

  // Grouped for display. With "All categories" selected this was one
  // undifferentiated grid of 51 tiles — finding a drink meant scanning past
  // every donut. Categories follow the CATEGORIES order so the page reads
  // the same way every time, and an empty one is skipped rather than
  // printing a header over nothing.
  const grouped = CATEGORIES
    .filter(c => c !== 'all')
    .map(c => ({ category: c, items: items.filter(i => i.category === c) }))
    .filter(g => g.items.length > 0)

  // Anything whose category isn't in the list — a renamed or legacy value —
  // would otherwise vanish from the page entirely while still existing, and
  // still being sold.
  const ungrouped = items.filter(i => !CATEGORIES.includes(i.category))
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #FFD6E8', borderRadius: 8, fontSize: 14 } as const

  if (loading) return <div>{t('common.loading')}</div>

  return (
    <div>
      {items.length === 0 && !showForm && (
        <div style={{ padding: '32px 20px', background: '#FFF0F5', borderRadius: 16, marginBottom: 24, border: '2px dashed #FFD6E8' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#127849;</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#333' }}>{t('menu.emptyTitle')}</h3>
            <p style={{ fontSize: 14, color: '#888', maxWidth: 460, margin: '0 auto' }}>
              Pick a starter template below — items load with $0 prices that you can customize. Or start from scratch.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
            {templates.map(tmpl => (
              <div key={tmpl.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #FFD6E8', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A2E' }}>{tmpl.name}</div>
                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5, flex: 1 }}>{tmpl.description}</div>
                <div style={{ fontSize: 11, color: '#FF1493', fontWeight: 700 }}>{tmpl.item_count} items</div>
                <button
                  onClick={() => loadTemplate(tmpl.id, tmpl.name, tmpl.item_count)}
                  disabled={loadingTemplate !== null}
                  style={{
                    marginTop: 4, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: loadingTemplate === tmpl.id ? '#ccc' : '#FF1493',
                    color: '#fff', border: 'none', cursor: loadingTemplate ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingTemplate === tmpl.id ? t('common.loading') : `Use ${tmpl.name}`}
                </button>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={openAdd} style={{ padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#fff', color: '#FF1493', border: '2px solid #FF1493', cursor: 'pointer' }}>
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
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          {templates.length > 0 && items.length > 0 && (
            <button onClick={() => setShowTemplatePicker(true)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fff', color: '#6366F1', border: '1px solid #6366F1', cursor: 'pointer', whiteSpace: 'nowrap' }}>🔄 Switch Template</button>
          )}
          <button onClick={() => setShowBulk(true)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fff', color: '#FF1493', border: '1px solid #FF1493', cursor: 'pointer', whiteSpace: 'nowrap' }}>💲 Bulk Price</button>
          <button onClick={openAdd} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('menu.addItem')}</button>
        </div>
      </div>

      {showTemplatePicker && (
        <div onClick={() => setShowTemplatePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Switch Menu Template</h3>
            <div style={{ background: '#FEF3C7', color: '#92400E', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              ⚠️ Switching will <strong>replace your entire menu</strong>. Items with past orders are archived (not deleted); everything else is removed. Custom prices and photos are lost.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {templates.map(tmpl => (
                <div key={tmpl.id} style={{ background: '#FFF8FB', borderRadius: 12, padding: 16, border: '1px solid #FFD6E8', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1A1A2E' }}>{tmpl.name}</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5, flex: 1 }}>{tmpl.description}</div>
                  <div style={{ fontSize: 11, color: '#FF1493', fontWeight: 700 }}>{tmpl.item_count} items</div>
                  <button
                    onClick={() => loadTemplate(tmpl.id, tmpl.name, tmpl.item_count)}
                    disabled={loadingTemplate !== null}
                    style={{
                      marginTop: 4, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: loadingTemplate === tmpl.id ? '#ccc' : '#6366F1',
                      color: '#fff', border: 'none', cursor: loadingTemplate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loadingTemplate === tmpl.id ? t('common.loading') : `Switch to ${tmpl.name}`}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setShowTemplatePicker(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div onClick={resetBulk} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Bulk Price Update</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              {bulkTarget === 'online'
                ? 'Set online prices from your counter prices — add a percentage or a fixed amount to cover the commission on app orders.'
                : 'Apply a flat price, a percentage or a fixed amount to multiple items at once.'}
            </p>

            {/* Counter vs online, first: it changes what every field below
                means, and burying it under Mode made "+20%" ambiguous. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['counter', 'online'] as const).map(tg => (
                <button
                  key={tg}
                  onClick={() => { setBulkTarget(tg); setBulkPreview(null) }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: bulkTarget === tg ? '2px solid #FF1493' : '1px solid #ddd',
                    background: bulkTarget === tg ? '#FFF0F6' : '#fff',
                    color: bulkTarget === tg ? '#FF1493' : '#555',
                  }}
                >
                  {tg === 'counter' ? 'Counter prices' : 'Online prices'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Mode</label>
                <select value={bulkMode} onChange={e => { setBulkMode(e.target.value as 'flat' | 'percent' | 'amount'); setBulkPreview(null) }} style={inputStyle}>
                  <option value="percent">{bulkTarget === 'online' ? 'Counter price + percent' : 'Percent change (+/-)'}</option>
                  <option value="amount">{bulkTarget === 'online' ? 'Counter price + amount' : 'Add a fixed amount (+/-)'}</option>
                  <option value="flat">Set flat price</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Category</label>
                <select value={bulkCategory} onChange={e => { setBulkCategory(e.target.value); setBulkPreview(null) }} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
                {bulkMode === 'flat'
                  ? 'New price (USD)'
                  : bulkMode === 'amount'
                    ? 'Amount to add (USD, e.g. 0.50)'
                    : 'Percent to add (e.g. 20 = +20%, -5 = -5%)'}
              </label>
              <input
                type="number"
                step={bulkMode === 'percent' ? '0.5' : '0.01'}
                value={bulkValue}
                onChange={e => { setBulkValue(e.target.value); setBulkPreview(null) }}
                placeholder={bulkMode === 'flat' ? '2.50' : bulkMode === 'amount' ? '0.50' : '20'}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <div>
                {/* A 20% markup on $1.35 is $1.62. Rounding up keeps prices
                    tidy without ever landing under the markup's intent. */}
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Round up to</label>
                <select value={bulkRound} onChange={e => { setBulkRound(e.target.value); setBulkPreview(null) }} style={inputStyle}>
                  <option value="0">No rounding</option>
                  <option value="0.05">Nearest $0.05</option>
                  <option value="0.10">Nearest $0.10</option>
                  <option value="0.25">Nearest $0.25</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', paddingBottom: 10 }}>
                <input type="checkbox" checked={bulkVariants} onChange={e => { setBulkVariants(e.target.checked); setBulkPreview(null) }} />
                Include variant options
              </label>
            </div>

            {bulkError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{bulkError}</div>
            )}

            {bulkPreview && (
              <div style={{ border: '1px solid #FFE4EF', borderRadius: 10, padding: 12, marginBottom: 12, background: '#FFF8FB' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
                  {bulkPreview.length === 0 ? 'No prices would change.' : `${bulkPreview.length} item${bulkPreview.length === 1 ? '' : 's'} will change:`}
                </div>
                {bulkPreview.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {bulkPreview.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #FFE4EF', fontSize: 13 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ color: '#888', flexShrink: 0 }}>${c.old_price.toFixed(2)} → <strong style={{ color: '#FF1493' }}>${c.new_price.toFixed(2)}</strong></span>
                      </div>
                    )).concat(
                      // Options priced separately from the item, shown so the
                      // dozen is visible before it changes — that is where
                      // most of the ticket value sits.
                      bulkPreview.flatMap(c => (c.options ?? []).map((o, oi) => (
                        <div key={`${c.id}-o${oi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 4px 16px', borderBottom: '1px solid #FFF0F5', fontSize: 12, color: '#777' }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {c.name} · {o.name}</span>
                          <span style={{ flexShrink: 0 }}>${o.old_price.toFixed(2)} → <strong style={{ color: '#FF1493' }}>${o.new_price.toFixed(2)}</strong></span>
                        </div>
                      )))
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={resetBulk} disabled={bulkBusy} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              {!bulkPreview ? (
                <button onClick={() => runBulk(true)} disabled={bulkBusy || !bulkValue} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: bulkBusy || !bulkValue ? '#ccc' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: bulkBusy || !bulkValue ? 'not-allowed' : 'pointer' }}>{bulkBusy ? '...' : 'Preview'}</button>
              ) : (
                <button onClick={() => runBulk(false)} disabled={bulkBusy || bulkPreview.length === 0} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: bulkBusy || bulkPreview.length === 0 ? '#ccc' : '#FF1493', color: '#fff', fontWeight: 700, fontSize: 13, cursor: bulkBusy || bulkPreview.length === 0 ? 'not-allowed' : 'pointer' }}>{bulkBusy ? '...' : `Apply to ${bulkPreview.length}`}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 12px', border: '1px solid #FFE4EF', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing?.id ? t('menu.editItem') : t('menu.newItem')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{t('menu.name')}</label><input style={inputStyle} value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>POS price <span style={{ fontWeight: 500 }}>(at the counter)</span></label><input style={inputStyle} type="number" step="0.01" value={editing?.price || ''} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
            {/* Online price is the shop's to set independently: DonutDash
                takes a commission on app orders that a counter sale doesn't,
                and this is where an owner covers it. Blank = same as counter,
                so nothing changes for a shop that ignores this field. */}
            <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Online price</label><input style={inputStyle} type="number" step="0.01" placeholder="same as counter" value={editing?.online_price ?? ''} onChange={e => setEditing({ ...editing, online_price: e.target.value })} /></div>
            {/* An option's own price is more specific than the item's, so it
                wins. Without this, setting the item's online price to $1.30
                on an item whose "1 Glazed" option says $1.50 looks like the
                edit silently failed — it saved, it just isn't what's read. */}
            {editVariants.some(g => g.options.some(o => o.price?.trim() || o.online_price?.trim())) && (
              <div style={{ gridColumn: '1 / -1', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#B54708' }}>
                <div>This item has priced options below. <strong>Option prices win</strong> — the prices above only apply to options left blank.</div>
                <button
                  type="button"
                  onClick={() => applyItemPricesToOptions()}
                  style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #B54708', background: '#fff', color: '#B54708', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Apply these prices to all options
                </button>
              </div>
            )}
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
                    <input title="Counter price" placeholder="0.00" type="number" step="0.01" value={opt.price} onChange={e => { const v = [...editVariants]; v[gi].options[oi].price = e.target.value; setEditVariants(v) }} style={{ width: 70, padding: '4px 8px', border: '1px solid #eee', borderRadius: 4, fontSize: 12 }} />
                    <span style={{ fontSize: 10, color: '#bbb' }}>online</span>
                    <input title="Online price — blank means same as counter" placeholder="same" type="number" step="0.01" value={opt.online_price ?? ''} onChange={e => { const v = [...editVariants]; v[gi].options[oi].online_price = e.target.value; setEditVariants(v) }} style={{ width: 70, padding: '4px 8px', border: '1px solid #eee', borderRadius: 4, fontSize: 12 }} />
                    <button type="button" onClick={() => { const v = [...editVariants]; v[gi].options = v[gi].options.filter((_, i) => i !== oi); setEditVariants(v) }} style={{ color: '#DC2626', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => { const v = [...editVariants]; v[gi].options.push({ name: '', price: '', online_price: '' }); setEditVariants(v) }} style={{ fontSize: 11, color: '#FF1493', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 16, marginTop: 4 }}>{t('menu.addOption')}</button>
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
        {filter === 'all' ? (
          <>
            {[...grouped, ...(ungrouped.length ? [{ category: 'other (uncategorised)', items: ungrouped }] : [])].map(group => (
              <div key={group.category} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 8px' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#888', margin: 0 }}>
                    {group.category}
                  </h3>
                  <span style={{ fontSize: 12, color: '#bbb' }}>{group.items.length}</span>
                </div>
                {/* One SortableContext per section: dragging reorders within
                    a category, which is what sort_order means to the
                    register. A single context across all of them let a tile
                    be dropped into another category's run and silently keep
                    its old category while moving in the order. */}
                <SortableContext items={group.items.map(i => i.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {group.items.map(item => (
                      <SortableMenuItem key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onToggle={toggleAvailable} onToggleSoldOut={toggleSoldOut} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
          </>
        ) : (
          <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {filtered.map(item => (
                <SortableMenuItem key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onToggle={toggleAvailable} onToggleSoldOut={toggleSoldOut} />
              ))}
            </div>
          </SortableContext>
        )}
      </DndContext>
    </div>
  )
}
