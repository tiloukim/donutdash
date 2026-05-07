import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import PosterClient from './poster-client'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'

async function lookupReferrer(rawCode: string): Promise<{ name: string; isDriver: boolean } | null> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return null
  const svc = createServiceClient()
  if (code.startsWith('DRV')) {
    const { data } = await svc.from('dd_users').select('name').eq('referral_code', code).maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash driver', isDriver: true }
  }
  if (code.startsWith('SHOP')) {
    const { data } = await svc.from('dd_shops').select('name').eq('referral_code', code).maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash shop', isDriver: false }
  }
  return null
}

export default async function ReferralPoster({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ audience?: string }>
}) {
  const { code: rawCode } = await params
  const { audience } = await searchParams
  const code = rawCode.toUpperCase()
  const info = await lookupReferrer(code)
  if (!info) notFound()

  const url = `${BASE_URL}/r/${encodeURIComponent(code)}`
  const aud: 'drivers' | 'shops' | 'both' =
    audience === 'drivers' || audience === 'shops' ? audience : 'both'

  return <PosterClient code={code} url={url} referrerName={info.name} audience={aud} />
}
