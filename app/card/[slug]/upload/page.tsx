import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import UploadCard from './upload-card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `Update photo — ${slug}`, robots: { index: false, follow: false } }
}

export default async function TeamPhotoUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t: token } = await searchParams
  if (!token) notFound()

  const svc = createServiceClient()
  const { data: member } = await svc
    .from('dd_team_members')
    .select('slug, name, title, photo_url, upload_token')
    .ilike('slug', slug)
    .maybeSingle()

  if (!member || !member.upload_token || member.upload_token !== token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FFF8F0' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>This link isn&apos;t valid</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Ask your admin for a new upload link.</p>
        </div>
      </div>
    )
  }

  return (
    <UploadCard
      slug={member.slug}
      name={member.name}
      title={member.title}
      currentPhoto={member.photo_url || null}
      token={token}
    />
  )
}
