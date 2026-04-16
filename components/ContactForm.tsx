'use client'

import { useState } from 'react'

interface ContactFormProps {
  category: 'customer' | 'driver' | 'shop_owner'
  accentColor?: string
  recipientEmail: string
}

export default function ContactForm({ category, accentColor = '#FF1493', recipientEmail }: ContactFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit.')
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
      }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>✅</span>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
          Message Sent!
        </h3>
        <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Thank you for reaching out. We&apos;ll get back to you at <strong>{email}</strong> as soon as possible.
        </p>
        <button
          onClick={() => { setSuccess(false); setName(''); setEmail(''); setSubject(''); setMessage('') }}
          style={{
            marginTop: '1rem', padding: '0.6rem 1.5rem',
            background: 'transparent', border: `1.5px solid ${accentColor}`,
            color: accentColor, borderRadius: '8px', fontWeight: 600,
            fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          Send another message
        </button>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.25rem' }}>
        Send us a message
      </h2>
      <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>
        We&apos;ll respond to {recipientEmail}
      </p>

      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '10px',
          padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#B91C1C',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#1A1A2E' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Your name"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#1A1A2E' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#1A1A2E' }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
            placeholder="What do you need help with?"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
            onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#1A1A2E' }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            placeholder="Describe your issue or question..."
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
            onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '0.85rem',
            background: submitting ? '#ccc' : accentColor,
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '1rem', fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {submitting ? 'Sending...' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
