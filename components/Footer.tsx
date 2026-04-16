import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      background: '#1A1A2E',
      color: 'white',
      padding: '3rem 1.5rem 2rem',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Logo centered */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/">
            <img src="/DonutDashfooterlogo.png" alt="DonutDash" style={{ height: '120px', width: 'auto', filter: 'brightness(1.1)', display: 'block', margin: '0 auto' }} />
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6, marginTop: '0.5rem' }}>
            Delicious donuts delivered fast to your door. Fresh from your favorite local shops.
          </p>
        </div>

        {/* Menu links centered */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap', textAlign: 'center' }}>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Explore</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Link href="/shops" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Browse Shops
              </Link>
              <Link href="/orders" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                My Orders
              </Link>
              <Link href="/cart" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Cart
              </Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Link href="/about" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                About Us
              </Link>
              <Link href="/terms" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Terms of Service
              </Link>
              <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Privacy Policy
              </Link>
              <Link href="/contractor-agreement" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Contractor Agreement
              </Link>
              <Link href="/sms-consent" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                SMS Consent
              </Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>For Business</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Link href="/shop" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Become a Partner
              </Link>
              <Link href="/driver" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Drive with Us
              </Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Support</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <a href="mailto:help@donutdash.app" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                help@donutdash.app
              </a>
              <a href="mailto:shops@donutdash.app" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Shop Owner Support
              </a>
              <a href="mailto:drivers@donutdash.app" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Driver Support
              </a>
            </div>
          </div>

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Follow Us</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <a href="https://www.facebook.com/profile.php?id=61575586874091" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
                Facebook
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1280px',
        margin: '2rem auto 0',
        paddingTop: '1.5rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.85rem',
      }}>
        &copy; {new Date().getFullYear()} DonutDash™. All rights reserved.
      </div>
    </footer>
  )
}
