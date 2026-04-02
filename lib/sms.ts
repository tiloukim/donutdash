/**
 * Send SMS via Twilio
 */
export async function sendSMS(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS')
    return false
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
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
