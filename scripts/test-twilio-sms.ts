import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv()

const TO = process.argv[2]
if (!TO) { console.error('Usage: npx tsx scripts/test-twilio-sms.ts +1XXXXXXXXXX'); process.exit(1) }

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID!

async function main() {
  console.log(`Sending test SMS to ${TO} via Twilio...`)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams({
    To: TO,
    Body: 'DonutDash test: Your Twilio SMS is working! 🍩',
    MessagingServiceSid: messagingServiceSid,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json()
  if (res.ok) {
    console.log(`✓ SMS sent! SID: ${data.sid}`)
    console.log(`  Status: ${data.status}`)
  } else {
    console.error(`✗ Failed: ${data.message || data.code}`)
    console.error(JSON.stringify(data, null, 2))
  }
}
main()
