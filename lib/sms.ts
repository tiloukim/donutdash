/**
 * Send SMS via Telnyx
 */
export async function sendSMS(to: string, body: string) {
  const apiKey = process.env.TELNYX_API_KEY
  const fromNumber = process.env.TELNYX_PHONE_NUMBER

  if (!apiKey || !fromNumber) {
    console.warn('Telnyx not configured, skipping SMS')
    return false
  }

  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromNumber, to, text: body }),
    })
    return res.ok
  } catch (err) {
    console.error('SMS send error:', err)
    return false
  }
}

/**
 * Send email via Resend API
 * Set RESEND_API_KEY env var
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Resend not configured, skipping email')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'DonutDash <notifications@donutdash.app>',
        to,
        subject,
        html,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}

/**
 * Send order status email to customer (wrapper around sendEmail for clarity)
 */
export async function sendOrderEmail(customerEmail: string, subject: string, html: string) {
  return sendEmail(customerEmail, subject, html)
}

/**
 * Build a branded DonutDash email template
 */
export function buildOrderEmailHtml(orderId: string, headline: string, message: string, extra?: string) {
  const shortId = orderId.slice(0, 8).toUpperCase()
  const trackUrl = `https://donutdash.app/orders/${orderId}`
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
      <div style="background:#FF8C00;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">DonutDash</h1>
      </div>
      <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
        <p style="color:#888;font-size:13px;margin:0 0 4px 0;">Order #${shortId}</p>
        <h2 style="margin:0 0 16px 0;color:#222;font-size:20px;">${headline}</h2>
        <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px 0;">${message}</p>
        ${extra || ''}
        <a href="${trackUrl}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#FF8C00;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Track Your Order</a>
        <p style="margin-top:24px;font-size:12px;color:#aaa;">You received this email because you placed an order on DonutDash.</p>
      </div>
    </div>
  `
}

/**
 * Send SMS + email to all admin contacts
 * SMS: ADMIN_PHONE_NUMBERS env var (comma-separated)
 * Email: ADMIN_EMAILS env var (comma-separated)
 */
export async function notifyAdmins(message: string, emailSubject?: string, emailHtml?: string) {
  const phones = process.env.ADMIN_PHONE_NUMBERS?.split(',').map(p => p.trim()).filter(Boolean)
  const emails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean)

  const promises: Promise<any>[] = []

  if (phones && phones.length > 0) {
    promises.push(...phones.map(phone => sendSMS(phone, message)))
  }

  if (emails && emails.length > 0) {
    const subject = emailSubject || 'DonutDash New Order Alert'
    const html = emailHtml || `<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#FF8C00;">DonutDash Order Alert</h2><pre style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</pre></div>`
    promises.push(...emails.map(email => sendEmail(email, subject, html)))
  }

  await Promise.all(promises)
}
