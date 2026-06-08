import { NextRequest, NextResponse } from 'next/server'
import { buildPitchForSlug } from '@/lib/pitch'

// GET /api/pitch/:slug
// Public, unauthenticated. Powers donutdash.app/claim/{slug}.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pitch = await buildPitchForSlug(slug)
  if (!pitch) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }
  return NextResponse.json(pitch)
}
