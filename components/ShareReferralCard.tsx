'use client'

import { useState } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'

export default function ShareReferralCard({
  code,
  accent = '#FF8C00',
  audience = 'both',
}: {
  code: string
  accent?: string
  audience?: 'drivers' | 'shops' | 'both'
}) {
  const [copied, setCopied] = useState(false)

  if (!code) return null

  const url = `${BASE_URL}/r/${encodeURIComponent(code)}`
  const posterUrl = `${BASE_URL}/r/${encodeURIComponent(code)}/poster?audience=${audience}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`
  const shareText = `Join me on DonutDash — use my referral code ${code} to get started.`
  // SMS body: text + URL on a separate line so iOS/Android render it as a tappable link.
  const smsBody = `${shareText}\n${url}`
  // iOS supports both ? and & after the colon; using `?&` is the cross-platform safe form.
  const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join me on DonutDash', text: shareText, url })
        return
      } catch {
        // User dismissed — fall through to copy
      }
    }
    copy()
  }

  const downloadQr = async () => {
    try {
      const res = await fetch(qrUrl)
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `donutdash-referral-${code}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objUrl)
    } catch {}
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20, marginBottom: 20,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>Share Your Link</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px 0' }}>
        Anyone who signs up using your link or scans your QR code gets your referral code applied automatically.
      </p>

      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt={`QR code for ${url}`}
          width={140}
          height={140}
          style={{ borderRadius: 10, border: '1px solid #FFE8D6', flexShrink: 0, background: '#fff' }}
        />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            background: '#FFF8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 10,
            fontSize: 13, color: '#92400E', wordBreak: 'break-all', border: '1px dashed #FFD9A8',
          }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={smsHref} style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 8, border: 'none',
              background: '#10B981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              textAlign: 'center', textDecoration: 'none',
            }}>
              💬 Text
            </a>
            <button onClick={share} style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 8, border: 'none',
              background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              📤 Share
            </button>
            <button onClick={copy} style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#333', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              {copied ? '✓ Copied' : '🔗 Copy Link'}
            </button>
            <button onClick={downloadQr} style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#333', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              ⬇ QR
            </button>
            <a href={posterUrl} style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#333', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              textAlign: 'center', textDecoration: 'none',
            }}>
              🖨 Print Poster
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
