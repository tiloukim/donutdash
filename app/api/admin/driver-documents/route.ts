import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET — fetch all driver documents (admin)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: documents } = await svc.from('dd_driver_documents')
    .select('*, driver:dd_users!driver_id(name, email, phone)')
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

  // Get the document to find the driver_id
  const { data: doc } = await svc.from('dd_driver_documents').select('driver_id').eq('id', documentId).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { error } = await svc.from('dd_driver_documents').update(updates).eq('id', documentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if all required documents are now approved — auto-update driver_status to pending_approval
  if (status === 'approved') {
    const { data: allDocs } = await svc.from('dd_driver_documents')
      .select('doc_type, status')
      .eq('driver_id', doc.driver_id)
      .eq('status', 'approved')
    const approvedTypes = new Set((allDocs || []).map((d: any) => d.doc_type))
    const requiredTypes = ['selfie', 'drivers_license', 'drivers_license_back', 'w9', 'insurance', 'vehicle_registration', 'vehicle_front', 'vehicle_back', 'vehicle_side', 'contractor_agreement']
    const allApproved = requiredTypes.every(t => approvedTypes.has(t))
    // Only transition pending_documents → pending_approval. If the
    // driver is already 'approved' (re-uploaded a doc for refresh),
    // don't demote them back to pending and stop them from receiving
    // offers. Same if rejected — that requires a manual reset.
    if (allApproved) {
      await svc.from('dd_users')
        .update({ driver_status: 'pending_approval' })
        .eq('id', doc.driver_id)
        .eq('driver_status', 'pending_documents')
    }
  }

  return NextResponse.json({ success: true })
}
