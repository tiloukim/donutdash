'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useShopLang } from '@/lib/shop-lang-context'
import { useVoiceRecorder } from '@/lib/use-voice-recorder'

export default function ShopSupportPage() {
  const { lang } = useShopLang()
  const [messages, setMessages] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()

  const isVoice = (msg: string) => msg.startsWith('[voice:') && msg.endsWith(']')
  const getVoiceUrl = (msg: string) => msg.slice(7, -1)

  const labels = {
    title: lang === 'km' ? 'ជំនួយគាំទ្រ' : 'Admin Support',
    subtitle: lang === 'km' ? 'ផ្ញើសារទៅក្រុមគ្រប់គ្រង DonutDash' : 'Chat with the DonutDash support team',
    placeholder: lang === 'km' ? 'វាយសារ...' : 'Type a message...',
    send: lang === 'km' ? 'ផ្ញើ' : 'Send',
    empty: lang === 'km' ? 'គ្មានសារទេ។ ផ្ញើសារដំបូងរបស់អ្នក!' : 'No messages yet. Send your first message!',
    you: lang === 'km' ? 'អ្នក' : 'You',
    admin: lang === 'km' ? 'អ្នកគ្រប់គ្រង' : 'Admin',
  }

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/support')
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setUserId(data.user_id || '')
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])
  useEffect(() => { const i = setInterval(fetchMessages, 5000); return () => clearInterval(i) }, [fetchMessages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/shop/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        if (!text) setInput('')
      }
    } catch {}
    setSending(false)
  }

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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{lang === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...'}</div>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: '#888' }}>{labels.subtitle}</p>
      </div>

      {/* Messages */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #FFE4EF',
        height: 'calc(100vh - 280px)', minHeight: 300,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 14 }}>
              {labels.empty}
            </div>
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
                    {isMe ? labels.you : (m.sender?.name || labels.admin)}
                    {' · '}
                    {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: isVoice(m.message) ? '6px 10px' : '10px 14px', borderRadius: 12,
                    background: isMe ? '#FF1493' : '#F3F4F6',
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

        {/* Input */}
        <div style={{
          borderTop: '1px solid #FFE4EF', padding: '12px 16px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {isRecording ? (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444' }}>{duration}s</span>
                <span style={{ fontSize: 12, color: '#888' }}>{lang === 'km' ? 'កំពុងថត...' : 'Recording...'}</span>
              </div>
              <button onClick={cancelRecording} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {lang === 'km' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button onClick={sendVoice} disabled={sending} style={{ padding: '8px 18px', borderRadius: 10, background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                {sending ? '...' : labels.send}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startRecording}
                title={lang === 'km' ? 'ថតសារសម្លេង' : 'Record voice message'}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #FFD6E8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
              >
                &#127908;
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={labels.placeholder}
                maxLength={1000}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #FFD6E8', fontSize: 14, outline: 'none' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: input.trim() && !sending ? '#FF1493' : '#ccc',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                }}
              >
                {labels.send}
              </button>
            </>
          )}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    </div>
  )
}
