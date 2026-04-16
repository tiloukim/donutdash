import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface NormalizedReview {
  id: string
  source: 'local' | 'google'
  author_name: string
  rating: number
  comment: string | null
  created_at: string       // ISO string, for sorting + display
  relative_time?: string   // e.g. "2 weeks ago" for Google
  profile_photo_url?: string | null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const [local, google] = await Promise.all([
    svc
      .from('dd_reviews')
      .select('id, shop_rating, comment, created_at, customer:dd_users!customer_id(name)')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    svc
      .from('dd_google_reviews')
      .select('id, author_name, profile_photo_url, rating, comment, relative_time, google_time')
      .eq('shop_id', id)
      .order('google_time', { ascending: false })
      .limit(20),
  ])

  const localRows: NormalizedReview[] = (local.data || []).map((r: any) => ({
    id: `local-${r.id}`,
    source: 'local',
    author_name: r.customer?.name || 'Customer',
    rating: r.shop_rating,
    comment: r.comment,
    created_at: r.created_at,
  }))

  const googleRows: NormalizedReview[] = (google.data || []).map((r: any) => ({
    id: `google-${r.id}`,
    source: 'google',
    author_name: r.author_name,
    rating: r.rating,
    comment: r.comment,
    created_at: r.google_time ? new Date(r.google_time * 1000).toISOString() : new Date().toISOString(),
    relative_time: r.relative_time,
    profile_photo_url: r.profile_photo_url,
  }))

  const merged = [...localRows, ...googleRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({ reviews: merged })
}
