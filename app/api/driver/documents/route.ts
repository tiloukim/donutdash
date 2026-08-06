import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const DOC_TYPES = ['w9', 'drivers_license', 'drivers_license_back', 'insurance', 'vehicle_registration', 'vehicle_front', 'vehicle_back', 'vehicle_side', 'contractor_agreement', 'selfie']

// GET — fetch driver's documents
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: documents } = await svc.from('dd_driver_documents')
    .select('*')
    .eq('driver_id', ddUser.id)
    .order('uploaded_at', { ascending: false })

  return NextResponse.json({ documents: documents || [] })
}

// POST — upload a document
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = formData.get('doc_type') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!docType || !DOC_TYPES.includes(docType)) return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or PDF.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'pdf'
    const fileName = `${ddUser.id}/${docType}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await svc.storage
      .from('driver-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Document upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = svc.storage
      .from('driver-documents')
      .getPublicUrl(fileName)

    // Upsert document record (replace existing for same type)
    const { data: existing } = await svc.from('dd_driver_documents')
      .select('id')
      .eq('driver_id', ddUser.id)
      .eq('doc_type', docType)
      .single()

    let doc
    if (existing) {
      const { data, error } = await svc.from('dd_driver_documents')
        .update({
          file_url: publicUrl,
          file_name: file.name,
          status: 'pending',
          admin_notes: null,
          uploaded_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      doc = data
    } else {
      const { data, error } = await svc.from('dd_driver_documents')
        .insert({
          driver_id: ddUser.id,
          doc_type: docType,
          file_url: publicUrl,
          file_name: file.name,
          status: 'pending',
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      doc = data
    }

    return NextResponse.json({ document: doc })
  } catch (err) {
    console.error('Document upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
