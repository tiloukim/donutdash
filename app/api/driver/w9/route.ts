import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — fetch driver's W-9 data (masked SSN for display)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users')
    .select('w9_legal_name, w9_business_name, w9_tax_classification, w9_address, w9_city, w9_state, w9_zip, w9_tax_id_type, w9_tax_id, w9_submitted_at')
    .eq('auth_id', user.id)
    .single()

  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Mask the tax ID for display
  if (ddUser.w9_tax_id) {
    if (ddUser.w9_tax_id_type === 'ssn') {
      ddUser.w9_tax_id = `XXX-XX-${ddUser.w9_tax_id.slice(-4)}`
    } else {
      ddUser.w9_tax_id = `XX-XXXXX${ddUser.w9_tax_id.slice(-2)}`
    }
  }

  return NextResponse.json({ w9: ddUser })
}

// POST — save W-9 data (full SSN stored securely)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const {
    legal_name, business_name, tax_classification,
    address, city, state, zip,
    tax_id_type, tax_id,
  } = body

  if (!legal_name?.trim()) return NextResponse.json({ error: 'Legal name is required' }, { status: 400 })
  if (!address?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return NextResponse.json({ error: 'Complete address is required' }, { status: 400 })
  }
  if (!tax_id?.trim()) return NextResponse.json({ error: 'Tax ID (SSN or EIN) is required' }, { status: 400 })

  // Validate SSN format (9 digits) or EIN format (9 digits)
  const digits = tax_id.replace(/\D/g, '')
  if (digits.length !== 9) {
    return NextResponse.json({ error: 'Tax ID must be 9 digits' }, { status: 400 })
  }

  const { error } = await svc.from('dd_users')
    .update({
      w9_legal_name: legal_name.trim(),
      w9_business_name: business_name?.trim() || null,
      w9_tax_classification: tax_classification || 'individual',
      w9_address: address.trim(),
      w9_city: city.trim(),
      w9_state: state.trim().toUpperCase(),
      w9_zip: zip.trim(),
      w9_tax_id_type: tax_id_type || 'ssn',
      w9_tax_id: digits, // store raw 9 digits
      w9_submitted_at: new Date().toISOString(),
    })
    .eq('id', ddUser.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
