import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'

export const metadata: Metadata = {
  title: 'Shop Owner Support | DonutDash',
  description: 'Get help managing your donut shop on DonutDash. Contact us at shops@donutdash.app.',
}

const PINK = '#FF1493'

const FAQS = [
  { q: 'How do I list my shop on DonutDash?', a: 'Sign up as a Shop Owner at donutdash.app/partner-setup. You\'ll set up your shop name, address, and menu. Our team will review and activate your listing.' },
  { q: 'How do I claim an existing shop?', a: 'If your shop is already listed as "Unclaimed", click "Claim this shop" on the shop card (desktop view). You\'ll need to upload business documents for verification.' },
  { q: 'How do I update my menu?', a: 'Go to your Shop Dashboard > Menu. You can add, edit, or remove items, set prices, upload photos, and mark items as sold out.' },
  { q: 'How do I set my business hours?', a: 'Go to Shop Dashboard > Hours. Set your open and close times for each day of the week.' },
  { q: 'How do I manage incoming orders?', a: 'Orders appear in your Dashboard and Orders tab in real-time. You\'ll hear an alert sound for new orders. Confirm, prepare, and mark them ready for pickup.' },
  { q: 'When do I receive payouts?', a: 'Payouts are processed weekly. View your earnings and payout history in the Bookkeeping section of your dashboard.' },
  { q: 'How do I upload my shop banner/logo?', a: 'Go to Shop Dashboard > Settings. You can upload a logo image and a banner image with a crop tool.' },
  { q: 'Can I have multiple locations?', a: 'Yes! Contact us at shops@donutdash.app and we\'ll help you set up additional locations under your account.' },
]

export default function ShopSupportPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
      <div className="desktop-only"><Navbar /></div>

      <main style={{ flex: 1, maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🏪</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem' }}>
            Shop Owner Support
          </h1>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
            Help with your shop listing, orders, menu, payouts, and more.
          </p>
        </div>

        {/* Contact Card */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '1.5rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.75rem' }}>
            Contact Shop Support
          </h2>
          <a
            href="mailto:shops@donutdash.app"
            style={{
              display: 'inline-block', padding: '0.85rem 2rem',
              background: PINK, color: 'white', borderRadius: '10px',
              fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
              marginBottom: '0.75rem',
            }}
          >
            Email shops@donutdash.app
          </a>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            You can also use the live Support Chat inside your Shop Dashboard.
          </p>
        </div>

        {/* Quick Links */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem', marginBottom: '2rem',
        }}>
          <Link href="/shop" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📊</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Shop Dashboard</span>
          </Link>
          <Link href="/partner-setup" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🤝</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Become a Partner</span>
          </Link>
          <Link href="/shop/support" style={{
            display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>💬</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Live Support Chat</span>
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
          <Link href="/support" style={{ color: PINK, fontWeight: 600, fontSize: '0.9rem' }}>
            &larr; Back to Support Hub
          </Link>
        </div>
      </main>

      <div className="desktop-only"><Footer /></div>
      <MobileBottomNav />
    </div>
  )
}
