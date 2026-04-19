import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password, name, phone, role } = await req.json()

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['customer', 'driver', 'shop_owner'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone: phone || null, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Create profile row
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      plan: 'free',
    }, { onConflict: 'id' })
  }

  return NextResponse.json({ user: data.user })
}
