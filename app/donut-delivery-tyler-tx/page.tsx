import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Donut Delivery in Tyler, TX | DonutDash',
  description:
    'Get fresh donuts delivered to your door in Tyler, Texas. DonutDash connects you with the best local donut shops for fast, reliable delivery. Order online today!',
  alternates: {
    canonical: '/donut-delivery-tyler-tx',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FoodDeliveryService',
  name: 'DonutDash - Tyler TX Donut Delivery',
  description:
    'Donut delivery service in Tyler, Texas. Order fresh donuts from local shops delivered fast to your door.',
  url: 'https://donutdash.app/donut-delivery-tyler-tx',
  areaServed: {
    '@type': 'City',
    name: 'Tyler',
    addressRegion: 'TX',
    addressCountry: 'US',
  },
  provider: {
    '@type': 'Organization',
    name: 'DonutDash',
    url: 'https://donutdash.app',
  },
}

export default function DonutDeliveryTylerTX() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '3rem 1.5rem',
          fontFamily: 'var(--font-dm-sans)',
          color: '#1A1A2E',
          lineHeight: 1.7,
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
            fontWeight: 800,
            marginBottom: '1rem',
            color: '#1A1A2E',
          }}
        >
          Donut Delivery in Tyler, TX
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>
          Craving fresh donuts but do not want to leave the house? DonutDash brings the best donuts
          in Tyler, Texas straight to your door. From glazed classics to specialty flavors, we
          partner with local donut shops to deliver fresh, warm donuts right when you want them.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          How Donut Delivery Works
        </h2>
        <ol
          style={{
            paddingLeft: '1.25rem',
            marginBottom: '2rem',
            fontSize: '1rem',
            color: '#555',
          }}
        >
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Browse local donut shops</strong> &mdash; See menus, ratings, and delivery times
            for donut shops near you in Tyler.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Build your order</strong> &mdash; Pick your favorite donuts, kolaches, coffee,
            and breakfast items. Add them to your cart.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Checkout and track</strong> &mdash; Pay securely online and track your delivery
            in real-time as your driver brings your order.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Enjoy fresh donuts</strong> &mdash; Your order arrives at your door, fresh and
            ready to eat.
          </li>
        </ol>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Why Choose DonutDash in Tyler?
        </h2>
        <ul
          style={{
            paddingLeft: '1.25rem',
            marginBottom: '2rem',
            fontSize: '1rem',
            color: '#555',
          }}
        >
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Local donut shops</strong> &mdash; We partner with real Tyler, TX donut shops,
            not chains.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Fast delivery</strong> &mdash; Most orders arrive in 15-30 minutes.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Real-time tracking</strong> &mdash; Know exactly where your donuts are.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Rewards program</strong> &mdash; Earn points with every order you place.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Free delivery</strong> on your first order.
          </li>
        </ul>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Delivering Across Tyler, Texas
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          DonutDash delivers throughout Tyler, TX and surrounding areas. Whether you are near the
          University of Texas at Tyler, downtown Tyler, or South Broadway, we have donut shops ready
          to serve you. Our delivery drivers know the area and get your donuts to you while they are
          still fresh.
        </p>

        <div
          style={{
            background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
            borderRadius: '14px',
            padding: '2rem',
            textAlign: 'center',
            marginTop: '2rem',
          }}
        >
          <h3 style={{ color: 'white', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Ready to order donuts in Tyler?
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
            Browse our partner donut shops and get fresh donuts delivered today.
          </p>
          <Link
            href="/shops"
            style={{
              display: 'inline-block',
              background: 'white',
              color: '#FF1493',
              padding: '0.75rem 2rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Browse Donut Shops
          </Link>
        </div>
      </main>
    </>
  )
}
