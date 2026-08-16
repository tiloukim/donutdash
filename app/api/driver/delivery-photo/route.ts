import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const deliveryId = formData.get('delivery_id') as string | null
    // 'pickup' = proof photo of the order at the shop; 'delivery' = drop-off proof.
    const photoType = formData.get('type') === 'pickup' ? 'pickup' : 'delivery'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!deliveryId) {
      return NextResponse.json({ error: 'No delivery_id provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    // Validate driver owns this delivery
    const { data: delivery } = await svc.from('dd_deliveries')
      .select('id, driver_id')
      .eq('id', deliveryId)
      .single()

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    if (delivery.driver_id !== ddUser.id && ddUser.role !== 'admin') {
      return NextResponse.json({ error: 'Not your delivery' }, { status: 403 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${deliveryId}-${photoType}-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await svc.storage
      .from('delivery-photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Delivery photo upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = svc.storage
      .from('delivery-photos')
      .getPublicUrl(fileName)

    // Update delivery record with photo URL (pickup vs drop-off column)
    const { error: updateError } = await svc.from('dd_deliveries')
      .update(photoType === 'pickup' ? { pickup_photo_url: publicUrl } : { delivery_photo_url: publicUrl })
      .eq('id', deliveryId)

    if (updateError) {
      console.error('Delivery photo URL update error:', updateError)
      return NextResponse.json({ error: 'Failed to save photo URL' }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('Delivery photo upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
