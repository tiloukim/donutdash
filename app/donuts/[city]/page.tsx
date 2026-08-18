import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ShopCard from '@/components/ShopCard'
import { createServiceClient } from '@/lib/supabase/server'
import type { Shop } from '@/lib/types'

// ISR: pre-render known markets, revalidate hourly, render other cities on demand.
export const revalidate = 3600

// "tyler-tx" -> { city: "tyler", state: "tx" }; multi-word cities keep their spaces.
function parseCitySlug(slug: string): { city: string; state: string } | null {
  const parts = slug.toLowerCase().split('-').filter(Boolean)
  if (parts.length < 2) return null
  const state = parts[parts.length - 1]
  if (state.length !== 2) return null
  return { city: parts.slice(0, -1).join(' '), state }
}

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

async function getCityShops(city: string, state: string): Promise<Shop[]> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('dd_shops')
    .select('*')
    .eq('is_active', true)
    .ilike('city', city)
    .ilike('state', state)
    .order('rating', { ascending: false })
  return (data || []) as Shop[]
}

export async function generateStaticParams() {
  try {
    const svc = createServiceClient()
    const { data } = await svc.from('dd_shops').select('city, state').eq('is_active', true)
    const set = new Set<string>()
    for (const s of data || []) {
      if (s.city && s.state) {
        set.add(`${String(s.city).toLowerCase().trim().replace(/\s+/g, '-')}-${String(s.state).toLowerCase().trim()}`)
      }
    }
    return [...set].map(city => ({ city }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params
  const parsed = parseCitySlug(slug)
  if (!parsed) return { title: 'Donut Shops | DonutDash' }
  const label = `${titleCase(parsed.city)}, ${parsed.state.toUpperCase()}`
  return {
    title: `Best Donut Shops in ${label} | DonutDash`,
    description: `Order fresh donuts, kolaches, and coffee from local donut shops in ${label}. Donut delivery near you with DonutDash.`,
    alternates: { canonical: `https://www.donutdash.app/donuts/${slug}` },
  }
}

export default async function CityDonutsPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params
  const parsed = parseCitySlug(slug)
  if (!parsed) notFound()

  const shops = await getCityShops(parsed.city, parsed.state)
  if (shops.length === 0) notFound() // Never generate a thin/empty city page.

  const label = `${titleCase(parsed.city)}, ${parsed.state.toUpperCase()}`
  // Orderable (claimed) shops first; unclaimed listings render as "coming soon".
  const ordered = [
    ...shops.filter(s => s.is_claimed !== false),
    ...shops.filter(s => s.is_claimed === false),
  ]
  const orderableCount = shops.filter(s => s.is_claimed !== false).length

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Donut shops in ${label}`,
    itemListElement: ordered.slice(0, 20).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: `https://www.donutdash.app/shops/${s.slug}`,
    })),
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav style={{ fontSize: '0.85rem', color: '#9CA3AF', marginBottom: '1rem' }}>
          <Link href="/" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Home</Link>
          {' / '}
          <Link href="/shops" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Shops</Link>
          {' / '}
          <span style={{ color: '#1A1A2E' }}>{label}</span>
        </nav>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, color: '#1A1A2E', margin: '0 0 0.5rem' }}>
          Donut shops in {label}
        </h1>
        <p style={{ color: '#77778A', margin: '0 0 2rem', maxWidth: 640, lineHeight: 1.55 }}>
          {orderableCount > 0
            ? `Order fresh donuts, kolaches, and coffee from ${orderableCount} local ${orderableCount === 1 ? 'shop' : 'shops'} delivering in ${label}.`
            : `Discover local donut shops in ${label}. These aren't on DonutDash yet — recommend your favorite to help bring it online.`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gridAutoRows: '1fr', gap: '1rem' }}>
          {ordered.map(shop => <ShopCard key={shop.id} shop={shop} />)}
        </div>
      </main>
    </>
  )
}
