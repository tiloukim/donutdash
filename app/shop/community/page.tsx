'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Category {
  id: string
  name: string
  icon: string
  description: string
  post_count: number
}

interface Post {
  id: string
  category_id: string
  author_id: string
  title: string
  body: string
  type: string
  location: string | null
  price: number | null
  is_pinned: boolean
  is_closed: boolean
  view_count: number
  reply_count: number
  images: string[]
  created_at: string
  updated_at: string
  author: { name: string }
  category: { name: string; icon: string }
  shop_name: string | null
}

interface Reply {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  author: { name: string }
  shop_name: string | null
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const TYPE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  discussion: { label: 'Discussion', bg: '#E8F5E9', color: '#2E7D32' },
  job: { label: 'Job Posting', bg: '#E3F2FD', color: '#1565C0' },
  equipment: { label: 'Equipment', bg: '#FFF3E0', color: '#E65100' },
  rental: { label: 'Rental', bg: '#F3E5F5', color: '#7B1FA2' },
  announcement: { label: 'Announcement', bg: '#FCE4EC', color: '#C62828' },
}

export default function CommunityPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  // Detail view
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    category_id: '',
    title: '',
    body: '',
    type: 'discussion',
    location: '',
    price: '',
  })
  const [creating, setCreating] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [postImages, setPostImages] = useState<string[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category_id', selectedCategory)
    if (searchDebounced) params.set('search', searchDebounced)
    const res = await fetch(`/api/shop/forum?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setPosts(data.posts || [])
    setCategories(data.categories || [])
    setUserId(data.user_id || '')
    setLoading(false)
  }, [selectedCategory, searchDebounced])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const openPost = async (post: Post) => {
    setSelectedPost(post)
    setDetailLoading(true)
    setReplyBody('')
    const res = await fetch(`/api/shop/forum/${post.id}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedPost(data.post)
      setReplies(data.replies || [])
    }
    setDetailLoading(false)
  }

  const submitReply = async () => {
    if (!replyBody.trim() || !selectedPost) return
    setReplying(true)
    const res = await fetch(`/api/shop/forum/${selectedPost.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody }),
    })
    if (res.ok) {
      const data = await res.json()
      setReplies(prev => [...prev, data.reply])
      setReplyBody('')
      // Update reply count in list
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, reply_count: p.reply_count + 1 } : p))
    }
    setReplying(false)
  }

  const deletePost = async () => {
    if (!selectedPost || !confirm('Delete this post and all replies?')) return
    setDeleting(true)
    const res = await fetch(`/api/shop/forum/${selectedPost.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== selectedPost.id))
      setSelectedPost(null)
    }
    setDeleting(false)
  }

  const uploadImage = async (file: File) => {
    setUploadingImages(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'forum')
    const res = await fetch('/api/shop/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const { url } = await res.json()
      setPostImages(prev => [...prev, url])
    }
    setUploadingImages(false)
  }

  const createPost = async () => {
    if (!createForm.category_id || !createForm.title.trim() || !createForm.body.trim()) return
    setCreating(true)
    const res = await fetch('/api/shop/forum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: createForm.category_id,
        title: createForm.title,
        body: createForm.body,
        type: createForm.type,
        location: createForm.location || null,
        price: createForm.price ? parseFloat(createForm.price) : null,
        images: postImages,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setPosts(prev => [data.post, ...prev])
      setShowCreate(false)
      setCreateForm({ category_id: '', title: '', body: '', type: 'discussion', location: '', price: '' })
      setPostImages([])
      setCategories(prev => prev.map(c => c.id === data.post.category_id ? { ...c, post_count: c.post_count + 1 } : c))
    }
    setCreating(false)
  }

  const showLocationField = createForm.type === 'job' || createForm.type === 'rental'
  const showPriceField = createForm.type === 'equipment' || createForm.type === 'rental'

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, fontSize: 16, color: '#888' }}>Loading...</div>
  }

  // Detail view
  if (selectedPost) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button
          onClick={() => setSelectedPost(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#FF1493', fontWeight: 600, marginBottom: 16, padding: 0 }}
        >
          &larr; Back to posts
        </button>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24 }}>
          {/* Post header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{selectedPost.category?.icon}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{selectedPost.category?.name}</span>
                {selectedPost.is_pinned && (
                  <span style={{ fontSize: 10, background: '#FF1493', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>Pinned</span>
                )}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{selectedPost.title}</h2>
            </div>
            {(selectedPost.author_id === userId) && (
              <button
                onClick={deletePost}
                disabled={deleting}
                style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {deleting ? '...' : 'Delete'}
              </button>
            )}
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, fontSize: 13, color: '#666' }}>
            <span style={{ fontWeight: 600, color: '#333' }}>{selectedPost.shop_name || selectedPost.author?.name}</span>
            <span>{timeAgo(selectedPost.created_at)}</span>
            <span>{selectedPost.view_count} views</span>
            {selectedPost.type && TYPE_BADGES[selectedPost.type] && (
              <span style={{ background: TYPE_BADGES[selectedPost.type].bg, color: TYPE_BADGES[selectedPost.type].color, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                {TYPE_BADGES[selectedPost.type].label}
              </span>
            )}
            {selectedPost.location && <span>📍 {selectedPost.location}</span>}
            {selectedPost.price != null && <span style={{ fontWeight: 700, color: '#FF1493' }}>${selectedPost.price.toFixed(2)}</span>}
          </div>

          {/* Body */}
          <div style={{ fontSize: 15, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
            {selectedPost.body}
          </div>

          {/* Images */}
          {selectedPost.images?.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              {selectedPost.images.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid #FFE4EF' }}>
                  <img src={url} alt="" style={{ maxWidth: 280, maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                </a>
              ))}
            </div>
          )}

          {/* Replies */}
          <div style={{ borderTop: '1px solid #FFE4EF', paddingTop: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>
              Replies ({replies.length})
            </h3>

            {detailLoading ? (
              <div style={{ color: '#888', fontSize: 14 }}>Loading replies...</div>
            ) : replies.length === 0 ? (
              <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>No replies yet. Be the first to respond!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {replies.map(r => (
                  <div key={r.id} style={{ background: '#FFF5F8', borderRadius: 10, padding: '14px 16px', border: '1px solid #FFE4EF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{r.shop_name || r.author?.name}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: '#444', whiteSpace: 'pre-wrap' }}>{r.body}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {!selectedPost.is_closed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  style={{
                    width: '100%', minHeight: 80, padding: 12, borderRadius: 10, border: '1px solid #FFE4EF',
                    fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#FF1493')}
                  onBlur={e => (e.target.style.borderColor = '#FFE4EF')}
                />
                <button
                  onClick={submitReply}
                  disabled={replying || !replyBody.trim()}
                  style={{
                    alignSelf: 'flex-end', background: '#FF1493', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    opacity: replying || !replyBody.trim() ? 0.5 : 1,
                  }}
                >
                  {replying ? 'Posting...' : 'Reply'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Community</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts..."
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 13,
              outline: 'none', width: 200, fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = '#FF1493')}
            onBlur={e => (e.target.style.borderColor = '#FFE4EF')}
          />
          <button
            onClick={() => { setShowCreate(true); if (!createForm.category_id && categories.length) setCreateForm(f => ({ ...f, category_id: categories[0].id })) }}
            style={{
              background: '#FF1493', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 16 }}>
        <button
          onClick={() => setSelectedCategory('')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid #FFE4EF', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            background: !selectedCategory ? '#FF1493' : '#fff',
            color: !selectedCategory ? '#fff' : '#333',
          }}
        >
          All ({posts.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid #FFE4EF', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: selectedCategory === cat.id ? '#FF1493' : '#fff',
              color: selectedCategory === cat.id ? '#fff' : '#333',
            }}
          >
            {cat.icon} {cat.name} ({cat.post_count})
          </button>
        ))}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 4 }}>No posts yet</div>
          <div style={{ fontSize: 14, color: '#888' }}>Be the first to start a discussion!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map(post => (
            <div
              key={post.id}
              onClick={() => openPost(post)}
              style={{
                background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: '16px 20px',
                cursor: 'pointer', transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(255,20,147,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Category + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13 }}>{post.category?.icon}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{post.category?.name}</span>
                    {post.is_pinned && (
                      <span style={{ fontSize: 10, background: '#FF1493', color: '#fff', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>Pinned</span>
                    )}
                    {post.type && TYPE_BADGES[post.type] && (
                      <span style={{ fontSize: 10, background: TYPE_BADGES[post.type].bg, color: TYPE_BADGES[post.type].color, padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                        {TYPE_BADGES[post.type].label}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.title}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#555' }}>{post.shop_name || post.author?.name}</span>
                    <span>{timeAgo(post.created_at)}</span>
                    {post.location && <span>📍 {post.location}</span>}
                    {post.price != null && <span style={{ fontWeight: 700, color: '#FF1493' }}>${post.price.toFixed(2)}</span>}
                    {post.images?.length > 0 && <span>📷 {post.images.length}</span>}
                  </div>
                  {/* Image thumbnails */}
                  {post.images?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {post.images.slice(0, 3).map((url: string, i: number) => (
                        <div key={i} style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', border: '1px solid #FFE4EF', flexShrink: 0 }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                      {post.images.length > 3 && <div style={{ width: 48, height: 48, borderRadius: 6, background: '#FFF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FF1493' }}>+{post.images.length - 3}</div>}
                    </div>
                  )}
                </div>

                {/* Reply count */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: '#FFF0F5', borderRadius: 10, padding: '8px 14px', flexShrink: 0, minWidth: 50,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#FF1493' }}>{post.reply_count}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>replies</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', maxHeight: '85vh',
            overflow: 'auto', padding: 28,
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginTop: 0, marginBottom: 20 }}>New Post</h3>

            {/* Category */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                value={createForm.category_id}
                onChange={e => setCreateForm(f => ({ ...f, category_id: e.target.value }))}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              >
                <option value="">Select category...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Post Type</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(TYPE_BADGES).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCreateForm(f => ({ ...f, type: key }))}
                    style={{
                      padding: '5px 12px', borderRadius: 16, border: '1px solid #FFE4EF', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer',
                      background: createForm.type === key ? '#FF1493' : '#fff',
                      color: createForm.type === key ? '#fff' : '#333',
                    }}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Title</label>
              <input
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Post title"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#FF1493')}
                onBlur={e => (e.target.style.borderColor = '#FFE4EF')}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Body</label>
              <textarea
                value={createForm.body}
                onChange={e => setCreateForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Write your post..."
                style={{
                  width: '100%', minHeight: 140, padding: 12, borderRadius: 8, border: '1px solid #FFE4EF',
                  fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = '#FF1493')}
                onBlur={e => (e.target.style.borderColor = '#FFE4EF')}
              />
            </div>

            {/* Location (conditional) */}
            {showLocationField && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Location (optional)</label>
                <input
                  value={createForm.location}
                  onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Dallas, TX"
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Price (conditional) */}
            {showPriceField && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Price (optional)</label>
                <input
                  type="number"
                  value={createForm.price}
                  onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Photos */}
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>Photos (optional)</label>
              {postImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {postImages.map((url, i) => (
                    <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #FFE4EF' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setPostImages(prev => prev.filter((_, j) => j !== i))} style={{
                        position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: '20px', textAlign: 'center', padding: 0,
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImages || postImages.length >= 5}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '2px dashed #FFE4EF', background: '#fff',
                  color: '#FF1493', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: uploadingImages || postImages.length >= 5 ? 0.5 : 1,
                }}
              >
                {uploadingImages ? '⏳ Uploading...' : `📷 Add Photo${postImages.length > 0 ? ` (${postImages.length}/5)` : ''}`}
              </button>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); if (imageInputRef.current) imageInputRef.current.value = '' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                disabled={creating || !createForm.category_id || !createForm.title.trim() || !createForm.body.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', background: '#FF1493', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: creating || !createForm.category_id || !createForm.title.trim() || !createForm.body.trim() ? 0.5 : 1,
                }}
              >
                {creating ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
