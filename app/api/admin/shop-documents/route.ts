import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET — fetch all shop documents (admin)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: documents } = await svc.from('dd_shop_documents')
    .select('*, shop:dd_shops!shop_id(name), uploader:dd_users!uploaded_by(name, email)')
    .order('uploaded_at', { ascending: false })

  return NextResponse.json({ documents: documents || [] })
}

// PATCH — approve/reject a document
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { documentId, status, admin_notes } = await req.json()
  if (!documentId || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: ddUser.id,
  }
  if (admin_notes) updates.admin_notes = admin_notes

  const { error } = await svc.from('dd_shop_documents').update(updates).eq('id', documentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
