import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Best Donuts in Tyler, Texas | DonutDash',
  description:
    'Discover the best donut shops in Tyler, TX. From classic glazed to creative specialty flavors, find top-rated local donut shops and order delivery through DonutDash.',
  alternates: {
    canonical: '/best-donuts-tyler',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Best Donuts in Tyler, Texas',
  description: 'Top-rated donut shops in Tyler, TX available for delivery on DonutDash.',
  url: 'https://donutdash.app/best-donuts-tyler',
  itemListOrder: 'https://schema.org/ItemListUnordered',
}

export default function BestDonutsTyler() {
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
          Best Donuts in Tyler, Texas
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>
          Tyler, Texas has a thriving donut scene with shops that have been serving the community
          for decades. DonutDash partners with the best local donut shops so you can enjoy their
          incredible donuts delivered right to your door.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          What Makes Tyler Donuts Special
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          Tyler donut shops are known for their early morning baking traditions, using recipes
          that have been perfected over the years. From perfectly glazed rings to filled
          long johns, kolaches, and donut holes, these shops offer variety that big chains
          simply cannot match. Many Tyler donut shops also serve fresh breakfast items,
          coffee, and kolaches alongside their signature donuts.
        </p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Popular Donut Types Available in Tyler
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
            <strong>Glazed Donuts</strong> &mdash; The classic, golden and perfectly sweet.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Chocolate Donuts</strong> &mdash; Rich chocolate icing on cake or yeast donuts.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Kolaches</strong> &mdash; A Texas favorite, filled with sausage, cheese, and
            jalapeno.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Apple Fritters</strong> &mdash; Crispy, cinnamon-spiced, and generously sized.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Cream-Filled Donuts</strong> &mdash; Bavarian cream, Boston cream, and more.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Donut Holes</strong> &mdash; Perfect bite-sized treats for sharing.
          </li>
        </ul>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Order from the Best Donut Shops
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '1rem' }}>
          DonutDash makes it easy to discover and order from Tyler's top donut shops. Browse
          menus, read ratings, and place your order for delivery in minutes. Whether you need
          a dozen donuts for the office, a breakfast treat for the family, or just a single
          glazed donut for yourself, our partner shops have you covered.
        </p>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '2rem' }}>
          Each shop on DonutDash is a real, local Tyler business. When you order through us,
          you are supporting your local community while enjoying the freshest donuts in East
          Texas.
        </p>

        <div
          style={{
            background: 'linear-gradient(135deg, #FF8C00, #FFA500)',
            borderRadius: '14px',
            padding: '2rem',
            textAlign: 'center',
            marginTop: '2rem',
          }}
        >
          <h3 style={{ color: 'white', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Explore Tyler Donut Shops
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
            See menus, ratings, and delivery times for donut shops near you.
          </p>
          <Link
            href="/shops"
            style={{
              display: 'inline-block',
              background: 'white',
              color: '#FF8C00',
              padding: '0.75rem 2rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            View All Shops
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
