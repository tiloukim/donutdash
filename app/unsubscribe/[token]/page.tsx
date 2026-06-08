// CAN-SPAM unsubscribe confirmation. The email's "Unsubscribe" footer
// link points here; the server component looks up the token, stamps
// unsubscribed_at on the recipient (idempotent — second click just
// re-confirms), and renders a plain confirmation page. The weekly
// cron treats unsubscribed_at IS NOT NULL as a hard stop.

import { createServiceClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params

  const svc = createServiceClient()
  const { data: recipient } = await svc
    .from('dd_pitch_campaign_recipients')
    .select('id, recipient_email, unsubscribed_at, shop_id, dd_shops(name)')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  let state: 'ok' | 'already' | 'notfound' = 'ok'

  if (!recipient) {
    state = 'notfound'
  } else if ((recipient as { unsubscribed_at?: string | null }).unsubscribed_at) {
    state = 'already'
  } else {
    await svc
      .from('dd_pitch_campaign_recipients')
      .update({
        unsubscribed_at: new Date().toISOString(),
        status: 'paused',
      })
      .eq('unsubscribe_token', token)
  }

  const email = (recipient as { recipient_email?: string } | null)?.recipient_email ?? ''
  const shopName = (recipient as { dd_shops?: { name?: string } } | null)?.dd_shops?.name ?? ''

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FFF8F0 0%, #FFFFFF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#FF8C00', marginBottom: 24 }}>🍩 DonutDash</div>

        {state === 'ok' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✓</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: '0 0 8px 0' }}>You&apos;ve been unsubscribed</h1>
            <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {email ? <>We won&apos;t send <strong>{email}</strong> any more outreach about </> : <>We won&apos;t send any more outreach about </>}
              {shopName ? <>your shop <strong>{shopName}</strong>.</> : <>this listing.</>} If you change your mind, just email us at{' '}
              <a href="mailto:hello@donutdash.app" style={{ color: '#FF8C00' }}>hello@donutdash.app</a>.
            </p>
          </>
        )}

        {state === 'already' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✓</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: '0 0 8px 0' }}>Already unsubscribed</h1>
            <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              No further action needed. Questions? <a href="mailto:hello@donutdash.app" style={{ color: '#FF8C00' }}>hello@donutdash.app</a>
            </p>
          </>
        )}

        {state === 'notfound' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: '0 0 8px 0' }}>Link not recognized</h1>
            <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              This unsubscribe link is invalid or expired. If you&apos;re still receiving emails, reply STOP or email{' '}
              <a href="mailto:hello@donutdash.app" style={{ color: '#FF8C00' }}>hello@donutdash.app</a> — we&apos;ll take you off the list manually.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
