import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/shop/',
          '/driver/',
          '/profile',
          '/checkout',
          '/cart',
          '/orders',
          // Internal POS APK install link — not something to surface in search.
          '/pos',
        ],
      },
    ],
    sitemap: 'https://donutdash.app/sitemap.xml',
  }
}
