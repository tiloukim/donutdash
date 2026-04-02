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
 * Send SMS to all admin phone numbers
 * Set ADMIN_PHONE_NUMBERS env var as comma-separated: +14301234567,+14309876543
 */
export async function notifyAdmins(message: string) {
  const phones = process.env.ADMIN_PHONE_NUMBERS?.split(',').map(p => p.trim()).filter(Boolean)
  if (!phones || phones.length === 0) return

  await Promise.all(phones.map(phone => sendSMS(phone, message)))
}
