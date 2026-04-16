import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CATEGORY_EMAILS: Record<string, string> = {
  customer: 'help@donutdash.app',
  driver: 'drivers@donutdash.app',
  shop_owner: 'shops@donutdash.app',
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, category, subject, message } = await req.json()

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    if (!['customer', 'driver', 'shop_owner'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Save to database
    const { error: insertErr } = await svc.from('dd_contact_submissions').insert({
      name: name.trim(),
      email: email.trim(),
      category,
      subject: subject.trim(),
      message: message.trim(),
    })

    if (insertErr) {
      console.error('Contact submission error:', insertErr)
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
    }

    // Try to send notification email to the right support inbox
    const toEmail = CATEGORY_EMAILS[category] || 'help@donutdash.app'
    try {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'DonutDash <notifications@donutdash.app>',
            to: toEmail,
            subject: `[Support] ${subject.trim()}`,
            html: `
              <h3>New Support Request</h3>
              <p><strong>From:</strong> ${name.trim()} (${email.trim()})</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Subject:</strong> ${subject.trim()}</p>
              <hr />
              <p>${message.trim().replace(/\n/g, '<br />')}</p>
            `,
            reply_to: email.trim(),
          }),
        })
      }
    } catch {
      // Email sending is best-effort; submission is already saved
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
