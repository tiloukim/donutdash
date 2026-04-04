import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'About DonutDash | Donut Delivery Platform',
  description:
    'DonutDash is a donut delivery platform by KIMCO LLC connecting customers with local donut shops in Tyler, Texas. Learn about our mission, how it works, and how to join.',
  alternates: {
    canonical: '/about',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About DonutDash',
  description: 'About DonutDash, a donut delivery platform serving Tyler, Texas.',
  url: 'https://donutdash.app/about',
  mainEntity: {
    '@type': 'Organization',
    name: 'DonutDash',
    legalName: 'KIMCO LLC DBA DonutDash',
    url: 'https://donutdash.app',
    logo: 'https://donutdash.app/logo.png',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tyler',
        addressRegion: 'TX',
        addressCountry: 'US',
      },
    },
  },
}

export default function AboutPage() {
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
          About DonutDash
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>
          DonutDash is a donut delivery platform built to connect customers with the best local
          donut shops in Tyler, Texas. We believe everyone deserves fresh, delicious donuts
          without the hassle of driving across town.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Our Mission
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          Our mission is simple: make it easy to enjoy fresh donuts from local shops. We support
          small businesses by giving them an online ordering and delivery platform, while
          giving customers a fast, convenient way to get their favorite treats delivered.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          The Company
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          DonutDash is operated by KIMCO LLC, based in Tyler, Texas. We are a local company
          that understands the Tyler community and is committed to supporting local donut
          shops and creating delivery jobs in the area.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          How It Works
        </h2>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', color: '#FF1493' }}>
          For Customers
        </h3>
        <ol
          style={{
            paddingLeft: '1.25rem',
            marginBottom: '1.5rem',
            fontSize: '1rem',
            color: '#555',
          }}
        >
          <li style={{ marginBottom: '0.4rem' }}>
            Browse local donut shops and their full menus
          </li>
          <li style={{ marginBottom: '0.4rem' }}>Add donuts, kolaches, coffee, and more to your cart</li>
          <li style={{ marginBottom: '0.4rem' }}>Check out securely and track your delivery in real-time</li>
          <li style={{ marginBottom: '0.4rem' }}>Enjoy fresh donuts at your door</li>
        </ol>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', color: '#FF8C00' }}>
          For Donut Shops
        </h3>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '1.5rem' }}>
          DonutDash gives donut shops an online presence with menu management, order notifications,
          and access to new customers through our delivery network. Shops can manage their own
          menu items, pricing, and availability through the shop dashboard. No upfront costs to
          join.
        </p>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', color: '#8B5CF6' }}>
          For Drivers
        </h3>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          DonutDash drivers are independent contractors who earn money delivering donuts in
          Tyler. Flexible hours, competitive pay, and a simple app to manage deliveries. Sign
          up as a driver to start earning.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Why DonutDash?
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
            <strong>Local first</strong> &mdash; We partner exclusively with local Tyler donut
            shops, not national chains.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Fresh and fast</strong> &mdash; Donuts are picked up and delivered quickly so
            they arrive fresh.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Community focused</strong> &mdash; Every order supports a local business and a
            local driver.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Easy to use</strong> &mdash; Simple ordering, real-time tracking, and secure
            payments.
          </li>
        </ul>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '2rem',
          }}
        >
          <Link
            href="/shops"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
              borderRadius: '14px',
              padding: '1.5rem',
              textAlign: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Browse Donut Shops
          </Link>
          <Link
            href="/signup"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #FF8C00, #FFA500)',
              borderRadius: '14px',
              padding: '1.5rem',
              textAlign: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Create an Account
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
