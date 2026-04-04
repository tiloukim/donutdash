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
        ],
      },
    ],
    sitemap: 'https://donutdash.app/sitemap.xml',
  }
}
