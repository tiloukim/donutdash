'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: string
  sender_id: string
  sender_role: 'customer' | 'driver'
  message: string
  created_at: string
}

interface ChatBoxProps {
  orderId: string
  currentRole: 'customer' | 'driver'
}

export default function ChatBox({ orderId, currentRole }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const otherLabel = currentRole === 'customer' ? 'Driver' : 'Customer'

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?order_id=${orderId}`)
      if (!res.ok) return
      const data = await res.json()
      const msgs: ChatMessage[] = data.messages || []
      if (data.user_id && !userId) setUserId(data.user_id)
      setMessages(msgs)
      // Track unread when collapsed
      const uid = data.user_id || userId
      if (!expanded && msgs.length > prevCountRef.current && uid) {
        const newMsgs = msgs.slice(prevCountRef.current)
        const otherNew = newMsgs.filter(m => m.sender_id !== uid)
        if (otherNew.length > 0) setUnread(prev => prev + otherNew.length)
      }
      prevCountRef.current = msgs.length
    } catch {}
  }, [orderId, userId, expanded])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Auto-scroll on new messages when expanded
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, expanded])

  // Clear unread when expanding
  useEffect(() => {
    if (expanded) setUnread(0)
  }, [expanded])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, message: text }),
      })
      if (res.ok) {
        await fetchMessages()
      }
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #FFE8D6',
      overflow: 'hidden',
    }}>
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid #FFE8D6' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#333' }}>
            Chat with {otherLabel}
          </span>
          {unread > 0 && (
            <span style={{
              background: '#FF8C00',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 10,
              padding: '2px 7px',
              minWidth: 18,
              textAlign: 'center',
            }}>
              {unread}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#888', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div>
          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              height: 300,
              overflowY: 'auto',
              padding: '12px 16px',
              background: '#FAFAFA',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.length === 0 && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bbb',
                fontSize: 13,
              }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map(msg => {
              const isOwn = msg.sender_id === userId
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOwn ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    fontSize: 10,
                    color: '#999',
                    marginBottom: 2,
                    fontWeight: 600,
                  }}>
                    {isOwn ? 'You' : otherLabel}
                  </div>
                  <div style={{
                    maxWidth: '75%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: isOwn ? '#FF8C00' : '#E5E7EB',
                    color: isOwn ? '#fff' : '#333',
                    fontSize: 14,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    borderBottomRightRadius: isOwn ? 4 : 12,
                    borderBottomLeftRadius: isOwn ? 12 : 4,
                  }}>
                    {msg.message}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#bbb',
                    marginTop: 2,
                  }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderTop: '1px solid #FFE8D6',
            background: '#fff',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${otherLabel.toLowerCase()}...`}
              maxLength={500}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 20,
                border: '1px solid #E5E7EB',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF8C00' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{
                padding: '10px 18px',
                borderRadius: 20,
                background: input.trim() ? '#FF8C00' : '#E5E7EB',
                color: input.trim() ? '#fff' : '#999',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
