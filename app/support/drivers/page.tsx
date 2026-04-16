import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'

export const metadata: Metadata = {
  title: 'Driver Support | DonutDash',
  description: 'Get help as a DonutDash delivery driver. Contact us at drivers@donutdash.app.',
}

const ORANGE = '#FF8C00'

const FAQS = [
  { q: 'How do I sign up as a driver?', a: 'Go to donutdash.app/driver and create an account. You\'ll need to upload your driver\'s license and insurance documents for approval.' },
  { q: 'How do I get delivery offers?', a: 'Once approved, go online from the Driver Home page. You\'ll receive offers with an alert sound when an order is ready for pickup nearby.' },
  { q: 'How much do I earn per delivery?', a: 'Earnings vary based on distance and order size, typically $4-$10+ per delivery plus tips. Check the Earnings tab for your history.' },
  { q: 'When do I get paid?', a: 'Payouts are processed weekly. You can view your pending and completed payouts in the Earnings section.' },
  { q: 'What if the shop isn\'t ready when I arrive?', a: 'Please wait at the shop. If the wait is excessive (15+ min), contact us at drivers@donutdash.app and we\'ll assist.' },
  { q: 'Can I decline a delivery offer?', a: 'Yes, you can decline any offer without penalty. The order will be offered to another driver.' },
  { q: 'What if the customer isn\'t available?', a: 'Try calling/texting the customer. If unreachable after 5 minutes, contact us for instructions.' },
]

export default function DriverSupportPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FFFAF5' }}>
      <div className="desktop-only"><Navbar /></div>

      <main style={{ flex: 1, maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🚗</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem' }}>
            Driver Support
          </h1>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
            Need help with deliveries, earnings, or your driver account? We&apos;ve got you covered.
          </p>
        </div>

        {/* Contact Card */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '1.5rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.75rem' }}>
            Contact Driver Support
          </h2>
          <a
            href="mailto:drivers@donutdash.app"
            style={{
              display: 'inline-block', padding: '0.85rem 2rem',
              background: ORANGE, color: 'white', borderRadius: '10px',
              fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
              marginBottom: '0.75rem',
            }}
          >
            Email drivers@donutdash.app
          </a>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            For urgent delivery issues, email us and include your order number.
          </p>
        </div>

        {/* Quick Links */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem', marginBottom: '2rem',
        }}>
          <Link href="/driver" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📍</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Driver Dashboard</span>
          </Link>
          <Link href="/driver/documents" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Upload Documents</span>
          </Link>
          <Link href="/driver/earnings" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>💵</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>View Earnings</span>
          </Link>
        </div>

        {/* FAQs */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '1.5rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '1rem' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid #f0f0f0' : 'none', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.35rem' }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.6, margin: 0 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/support" style={{ color: '#FF1493', fontWeight: 600, fontSize: '0.9rem' }}>
            &larr; Back to Support Hub
          </Link>
        </div>
      </main>

      <div className="desktop-only"><Footer /></div>
      <MobileBottomNav />
    </div>
  )
}
