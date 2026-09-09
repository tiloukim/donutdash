import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import type { Shop, MenuItem } from '@/lib/types'
import ShopDetailClient from './ShopDetailClient'

// This page used to be a single 'use client' component that fetched
// everything in useEffect. Client components ARE server-rendered for the
// initial HTML — but the data arrived later, so the server render only ever
// contained the loading shell. A crawler saw 25KB of chrome with the shop
// name zero times, the menu zero times, and the site-wide default <title>.
//
// Fetching here and seeding the client component's state via props puts the
// real content in the first byte, and lets us emit a per-shop title plus
// Restaurant/Menu structured data.
//
// ISR: shop details and menus change rarely; an hour keeps it fresh without
// hitting the database on every crawl.
export const revalidate = 3600

async function getShop(slug: string): Promise<Shop | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('dd_shops')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as Shop) ?? null
}

async function getMenu(shopId: string): Promise<MenuItem[]> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('dd_menu_items')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_available', true)
    .order('category', { ascending: true })
  return (data || []) as MenuItem[]
}

export async function generateStaticParams() {
  try {
    const svc = createServiceClient()
    const { data } = await svc.from('dd_shops').select('slug').eq('is_active', true)
    return (data || []).filter((s) => s.slug).map((s) => ({ slug: String(s.slug) }))
  } catch {
    // Build shouldn't fail because the DB was briefly unreachable — these
    // render on demand instead.
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const shop = await getShop(slug)
  if (!shop) {
    return { title: 'Shop not found | DonutDash' }
  }

  const where = [shop.city, shop.state].filter(Boolean).join(', ')
  // Lead with the shop name: this is the page that should rank for
  // "<shop name>" and "donuts <city>", and every shop page previously
  // shared one generic site-wide title.
  const title = where
    ? `${shop.name} — Donut Delivery & Pickup in ${where} | DonutDash`
    : `${shop.name} | DonutDash`
  const description =
    shop.description?.trim() ||
    `Order fresh donuts from ${shop.name}${where ? ` in ${where}` : ''}. ` +
      `Delivery and pickup through DonutDash — browse the menu and order ahead.`
  const image = shop.banner_url || shop.image_url || undefined

  return {
    title,
    description,
    alternates: { canonical: `https://donutdash.app/shops/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://donutdash.app/shops/${slug}`,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const shop = await getShop(slug)
  const menu = shop ? await getMenu(shop.id) : []

  // Restaurant + Menu structured data. This is what lets a search result
  // show the shop's address, rating and price range rather than a bare link,
  // and it's the machine-readable half of what the visible content says.
  const jsonLd = shop
    ? {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: shop.name,
        ...(shop.description ? { description: shop.description } : {}),
        ...(shop.image_url ? { image: shop.image_url } : {}),
        ...(shop.phone ? { telephone: shop.phone } : {}),
        url: `https://donutdash.app/shops/${slug}`,
        servesCuisine: 'Donuts',
        priceRange: '$',
        address: {
          '@type': 'PostalAddress',
          ...(shop.address ? { streetAddress: shop.address } : {}),
          ...(shop.city ? { addressLocality: shop.city } : {}),
          ...(shop.state ? { addressRegion: shop.state } : {}),
          ...(shop.zip ? { postalCode: shop.zip } : {}),
          addressCountry: 'US',
        },
        ...(shop.rating
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: shop.rating,
                reviewCount: shop.review_count || 1,
              },
            }
          : {}),
        ...(menu.length
          ? {
              hasMenu: {
                '@type': 'Menu',
                name: `${shop.name} Menu`,
                hasMenuSection: Object.entries(
                  menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
                    const key = item.category || 'Menu'
                    ;(acc[key] ||= []).push(item)
                    return acc
                  }, {}),
                ).map(([section, items]) => ({
                  '@type': 'MenuSection',
                  name: section,
                  hasMenuItem: items.map((i) => ({
                    '@type': 'MenuItem',
                    name: i.name,
                    ...(i.description ? { description: i.description } : {}),
                    offers: {
                      '@type': 'Offer',
                      price: Number(i.price).toFixed(2),
                      priceCurrency: 'USD',
                    },
                  })),
                })),
              },
            }
          : {}),
      }
    : null

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <ShopDetailClient initialShop={shop} initialMenu={menu} />
    </>
  )
}
