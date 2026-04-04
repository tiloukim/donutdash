'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useVoiceRecorder } from '@/lib/use-voice-recorder'

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
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()

  const isVoice = (msg: string) => msg.startsWith('[voice:') && msg.endsWith(']')
  const getVoiceUrl = (msg: string) => msg.slice(7, -1)

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

  const sendVoice = async () => {
    const blob = await stopRecording()
    if (!blob) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('file', blob, `voice-${Date.now()}.webm`)
      const uploadRes = await fetch('/api/voice-upload', { method: 'POST', body: formData })
      if (uploadRes.ok) {
        const { url } = await uploadRes.json()
        await sendMessage(`[voice:${url}]`)
      }
    } catch {}
    setSending(false)
  }

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || sending || !selectedShop) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: selectedShop, message: msg }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        if (!text) setInput('')
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
                        maxWidth: '70%', padding: isVoice(m.message) ? '6px 10px' : '10px 14px', borderRadius: 12,
                        background: isMe ? '#6366F1' : '#F3F4F6',
                        color: isMe ? '#fff' : '#333',
                        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>
                        {isVoice(m.message) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>&#127908;</span>
                            <audio src={getVoiceUrl(m.message)} controls preload="none" style={{ height: 32, maxWidth: 180 }} />
                          </div>
                        ) : m.message}
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
              {isRecording ? (
                <>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444' }}>{duration}s</span>
                    <span style={{ fontSize: 12, color: '#888' }}>Recording...</span>
                  </div>
                  <button onClick={cancelRecording} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button onClick={sendVoice} disabled={sending} style={{ padding: '8px 18px', borderRadius: 10, background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                    {sending ? '...' : 'Send'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startRecording}
                    title="Record voice message"
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
                  >
                    &#127908;
                  </button>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type a reply..."
                    maxLength={1000}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' }}
                  />
                  <button
                    onClick={() => sendMessage()}
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
                </>
              )}
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
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
