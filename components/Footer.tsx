import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      background: '#1A1A2E',
      color: 'white',
      padding: '3rem 1.5rem 2rem',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '2rem',
      }}>
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <img src="/logo.png" alt="DonutDash" style={{ height: '36px', width: 'auto', filter: 'brightness(1.1)' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Delicious donuts delivered fast to your door. Fresh from your favorite local shops.
          </p>
        </div>

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
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>About Us</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Contact</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Careers</span>
          </div>
        </div>

        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>For Business</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Link href="/signup" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Become a Partner
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Drive with Us</span>
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
        &copy; {new Date().getFullYear()} DonutDash. All rights reserved.
      </div>
    </footer>
  )
}
