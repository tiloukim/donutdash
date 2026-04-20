import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Customer Support | DonutDash',
  description: 'Get help with your DonutDash orders, deliveries, and account. Contact us at help@donutdash.app.',
}

const PINK = '#FF1493'

const FAQS = [
  { q: 'How do I place an order?', a: 'Browse shops on the home page, add items to your cart, and checkout. You can pay with credit/debit card.' },
  { q: 'How long does delivery take?', a: 'Most orders are delivered within 20-35 minutes depending on your distance from the shop and order volume.' },
  { q: 'Can I cancel my order?', a: 'You can cancel before the shop starts preparing your order. Go to My Orders and tap the order to cancel.' },
  { q: 'How do I track my delivery?', a: 'Once your order is picked up by a driver, you can track their location in real-time from the order details page.' },
  { q: 'What if my order is wrong or missing items?', a: 'Contact us at help@donutdash.app with your order number and we\'ll make it right.' },
  { q: 'How do I save my favorite shops?', a: 'Tap the heart icon on any shop card to add it to your favorites. View them from the Favorites tab on the Browse page.' },
]

export default async function CustomerSupportPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('dd_role')?.value || 'customer'
  const isCustomer = role === 'customer'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
      <div className="desktop-only"><Navbar /></div>

      <main style={{ flex: 1, maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>💬</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem' }}>
            Customer Support
          </h1>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
            We&apos;re here to help with your orders, deliveries, and account.
          </p>
        </div>

        {/* Contact Form */}
        <div style={{ marginBottom: '2rem' }}>
          <ContactForm category="customer" accentColor={PINK} recipientEmail="help@donutdash.app" />
        </div>

        {/* Other support links — hide for customers */}
        {!isCustomer && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem', marginBottom: '2rem',
          }}>
            <Link href="/support/shops" style={{
              display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🏪</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Shop Owner Support</span>
            </Link>
            <Link href="/support/drivers" style={{
              display: 'block', background: 'white', borderRadius: '12px', padding: '1.25rem',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)', textDecoration: 'none', textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🚗</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1A2E' }}>Driver Support</span>
            </Link>
          </div>
        )}

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
      </main>

      <div className="desktop-only"><Footer /></div>
      <MobileBottomNav />
    </div>
  )
}
