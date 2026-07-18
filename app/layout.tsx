export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { CartProvider } from '@/lib/cart-context'
import ConditionalFooter from '@/components/ConditionalFooter'
import CookieConsent from '@/components/CookieConsent'
import InstallPrompt from '@/components/InstallPrompt'
import PageTracker from '@/components/PageTracker'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'DonutDash - Donut Delivery in Tyler, TX & East Texas | Fresh Donuts Delivered Fast',
  description:
    'Order fresh donuts delivered to your door in Tyler, TX and across East Texas. Browse local donut shops, track your delivery in real-time, and enjoy delicious donuts fast. Free delivery on your first order!',
  keywords:
    'donut delivery, tyler tx, east texas donuts, donut shop, order donuts online, donut delivery near me, tyler texas donuts, east texas donut delivery',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  metadataBase: new URL('https://www.donutdash.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Donut Delivery in Tyler and East Texas | Fresh Donuts | Delivered Fast',
    description:
      'Order fresh donuts delivered to your door. Browse local donut shops in Tyler and East Texas.',
    url: 'https://www.donutdash.app',
    siteName: 'DonutDash',
    images: [
      {
        url: '/OG-LOG-new.png',
        width: 1200,
        height: 630,
        alt: 'DonutDash - Donut Delivery in Tyler, TX & East Texas',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donut Delivery in Tyler and East Texas | Fresh Donuts | Delivered Fast',
    description:
      'Order fresh donuts delivered to your door. Browse local donut shops in Tyler and East Texas.',
    images: ['/OG-LOG-new.png'],
  },
  verification: {
    google: 'sSHbUVG0jA9lCCh2GKLSzI4OC9-cmeq8VaGgzVDAvR4',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'DonutDash',
                  legalName: 'DonutDash Technologies LLC',
                  url: 'https://www.donutdash.app',
                  logo: 'https://www.donutdash.app/logo.png',
                  sameAs: ['https://www.facebook.com/profile.php?id=61575586874091'],
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer service',
                    email: 'support@donutdash.app',
                  },
                },
                {
                  '@type': 'LocalBusiness',
                  '@id': 'https://www.donutdash.app/#localbusiness',
                  name: 'DonutDash',
                  description:
                    'Donut delivery platform serving Tyler, TX and East Texas. Order fresh donuts from local shops delivered to your door.',
                  url: 'https://www.donutdash.app',
                  image: 'https://www.donutdash.app/logo.png',
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Tyler',
                    addressRegion: 'TX',
                    addressCountry: 'US',
                  },
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: 32.3513,
                    longitude: -95.3011,
                  },
                  areaServed: [
                    {
                      '@type': 'City',
                      name: 'Tyler',
                      '@id': 'https://www.wikidata.org/wiki/Q128261',
                    },
                    {
                      '@type': 'Place',
                      name: 'East Texas',
                    },
                  ],
                  priceRange: '$',
                  servesCuisine: 'Donuts',
                },
              ],
            }),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {})
            })
          }
        `}} />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} antialiased`}>
        <AuthProvider>
          <CartProvider>
            {children}
            <ConditionalFooter />
          </CartProvider>
          <PageTracker />
        </AuthProvider>
        <InstallPrompt />
        <CookieConsent />
      </body>
    </html>
  )
}
