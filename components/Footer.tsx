import Link from 'next/link'
import { cookies } from 'next/headers'

const linkStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '0.85rem',
  textDecoration: 'none',
  transition: 'color 0.2s',
  lineHeight: 1.8,
}

const headingStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: '0.5rem',
  fontSize: '0.9rem',
  letterSpacing: '0.02em',
}

export default async function Footer() {
  const cookieStore = await cookies()
  const role = cookieStore.get('dd_role')?.value || 'customer'
  const isCustomer = role === 'customer'

  return (
    <footer style={{ background: '#1A1A2E', color: 'white', padding: '2.5rem 1.5rem 1.5rem' }}>
      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem 2rem;
          text-align: left;
        }
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: repeat(${isCustomer ? 3 : 4}, 1fr);
            gap: 2rem 3rem;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <Link href="/">
            <img src="/DonutDashfooterlogo.png" alt="DonutDash" style={{ height: '80px', width: 'auto', filter: 'brightness(1.1)', display: 'block', margin: '0 auto' }} />
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.5rem', maxWidth: '320px', margin: '0.5rem auto 0' }}>
            Delicious donuts delivered fast to your door. Fresh from your favorite local shops.
          </p>
        </div>

        {/* Links grid */}
        <div className="footer-grid">
          <div>
            <h4 style={headingStyle}>Explore</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link href="/shops" style={linkStyle}>Browse Shops</Link>
              <Link href="/orders" style={linkStyle}>My Orders</Link>
              <Link href="/cart" style={linkStyle}>Cart</Link>
            </div>
          </div>

          <div>
            <h4 style={headingStyle}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link href="/about" style={linkStyle}>About Us</Link>
              <Link href="/terms" style={linkStyle}>Terms of Service</Link>
              <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>
              {!isCustomer && <Link href="/contractor-agreement" style={linkStyle}>Contractor Agreement</Link>}
              <Link href="/sms-consent" style={linkStyle}>SMS Consent</Link>
            </div>
          </div>

          {!isCustomer && (
            <div>
              <h4 style={headingStyle}>For Business</h4>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Link href="/shop" style={linkStyle}>Become a Partner</Link>
                <Link href="/driver" style={linkStyle}>Drive with Us</Link>
              </div>
            </div>
          )}

          <div>
            <h4 style={headingStyle}>Support</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link href="/support" style={linkStyle}>Customer Help</Link>
              {!isCustomer && (
                <>
                  <Link href="/support/shops" style={linkStyle}>Shop Support</Link>
                  <Link href="/support/drivers" style={linkStyle}>Driver Support</Link>
                </>
              )}
            </div>
            <h4 style={{ ...headingStyle, marginTop: '1rem' }}>Follow Us</h4>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <a href="https://www.facebook.com/profile.php?id=61575586874091" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Facebook
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1080px',
        margin: '1.5rem auto 0',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '0.8rem',
      }}>
        &copy; {new Date().getFullYear()} DonutDash&trade;. All rights reserved.
      </div>
    </footer>
  )
}
