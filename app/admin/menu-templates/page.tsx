'use client'

import { useEffect, useRef, useState } from 'react'

type TemplateItem = {
  name: string
  description: string
  category: string
  image_url: string | null
}

type Template = {
  id: string
  name: string
  description: string
  items: TemplateItem[]
}

export default function AdminMenuTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string>('')
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchData = async () => {
    const res = await fetch('/api/admin/menu-templates')
    const data = await res.json()
    if (data?.templates) {
      setTemplates(data.templates)
      if (!activeId && data.templates.length > 0) setActiveId(data.templates[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const active = templates.find(t => t.id === activeId)

  const handleUpload = async (templateId: string, itemName: string, file: File) => {
    const key = `${templateId}::${itemName}`
    setUploading(key)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        alert('Image upload failed')
        return
      }
      const { url } = await uploadRes.json()

      const saveRes = await fetch('/api/admin/menu-templates/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, item_name: itemName, image_url: url }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json()
        alert(err.error || 'Failed to save image')
        return
      }
      setTemplates(prev => prev.map(t => t.id !== templateId ? t : {
        ...t,
        items: t.items.map(i => i.name === itemName ? { ...i, image_url: url } : i),
      }))
    } finally {
      setUploading(null)
    }
  }

  const removeImage = async (templateId: string, itemName: string) => {
    if (!confirm(`Remove image for "${itemName}"?`)) return
    const res = await fetch('/api/admin/menu-templates/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, item_name: itemName }),
    })
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id !== templateId ? t : {
        ...t,
        items: t.items.map(i => i.name === itemName ? { ...i, image_url: null } : i),
      }))
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading templates…</div>

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Menu Template Images</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Upload images for each template item. When a shop owner loads a template, items inherit these photos.
        </p>
      </div>

      {/* Template tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {templates.map(t => {
          const filled = t.items.filter(i => i.image_url).length
          const total = t.items.length
          return (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              style={{
                padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: activeId === t.id ? '#6366F1' : '#fff',
                color: activeId === t.id ? '#fff' : '#374151',
                fontWeight: 700, fontSize: 13,
                boxShadow: activeId === t.id ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {t.name} <span style={{ opacity: 0.85, marginLeft: 6, fontSize: 11 }}>{filled}/{total}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>{active.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {active.items.map(item => {
              const key = `${active.id}::${item.name}`
              const isUploading = uploading === key
              return (
                <div key={item.name} style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden',
                    background: item.image_url ? '#000' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 32, color: '#D1D5DB' }}>🍩</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.category}</div>
                  </div>
                  <input
                    ref={el => { fileRefs.current[key] = el }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(active.id, item.name, f)
                      if (fileRefs.current[key]) fileRefs.current[key]!.value = ''
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => fileRefs.current[key]?.click()}
                      disabled={isUploading}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: isUploading ? 'wait' : 'pointer',
                        background: isUploading ? '#ccc' : '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700,
                      }}
                    >
                      {isUploading ? 'Uploading…' : (item.image_url ? 'Replace' : 'Upload')}
                    </button>
                    {item.image_url && (
                      <button
                        onClick={() => removeImage(active.id, item.name)}
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
