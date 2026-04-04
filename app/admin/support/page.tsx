'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function AdminSupportPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedShop, setSelectedShop] = useState<string | null>(null)
  const [selectedShopName, setSelectedShopName] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])
  useEffect(() => { const i = setInterval(fetchConversations, 8000); return () => clearInterval(i) }, [fetchConversations])

  const openChat = async (shopId: string, shopName: string) => {
    setSelectedShop(shopId)
    setSelectedShopName(shopName)
    try {
      const res = await fetch(`/api/admin/support?shop_id=${shopId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setUserId(data.user_id || '')
        fetchConversations() // refresh unread counts
      }
    } catch {}
  }

  // Poll messages when chat is open
  useEffect(() => {
    if (!selectedShop) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/support?shop_id=${selectedShop}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch {}
    }
    const i = setInterval(poll, 5000)
    return () => clearInterval(i)
  }, [selectedShop])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending || !selectedShop) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: selectedShop, message: input.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setInput('')
      }
    } catch {}
    setSending(false)
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading support chats...</div>

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 160px)', minHeight: 400 }}>
      {/* Conversation List */}
      <div style={{
        width: 280, flexShrink: 0, background: '#fff', borderRadius: 12,
        border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 16 }}>
          Shop Support {totalUnread > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>{totalUnread}</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#999', fontSize: 13 }}>No support conversations yet</div>
          ) : (
            conversations.map(c => (
              <div
                key={c.shop_id}
                onClick={() => openChat(c.shop_id, c.shop_name)}
                style={{
                  padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                  background: selectedShop === c.shop_id ? '#F0F0FF' : '#fff',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.shop_name}</span>
                  {c.unread > 0 && (
                    <span style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{c.unread}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_message}
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                  {new Date(c.last_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {selectedShop ? (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 16 }}>
              {selectedShopName}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 14 }}>No messages yet</div>
              ) : (
                messages.map((m: any) => {
                  const isMe = m.sender_id === userId
                  return (
                    <div key={m.id} style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>
                        {isMe ? 'You (Admin)' : (m.sender?.name || 'Shop Owner')}
                        {' · '}
                        {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <div style={{
                        maxWidth: '70%', padding: '10px 14px', borderRadius: 12,
                        background: isMe ? '#6366F1' : '#F3F4F6',
                        color: isMe ? '#fff' : '#333',
                        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>
                        {m.message}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div style={{
              borderTop: '1px solid #E5E7EB', padding: '12px 16px',
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a reply..."
                maxLength={1000}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: '1px solid #D1D5DB', fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: input.trim() && !sending ? '#6366F1' : '#ccc',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#128172;</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Select a conversation</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose a shop from the left to view messages</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
