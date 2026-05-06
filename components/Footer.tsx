'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function getRole(): string {
  if (typeof document === 'undefined') return 'customer'
  const match = document.cookie.match(/(?:^|;\s*)dd_role=([^;]*)/)
  return match ? match[1] : 'customer'
}

export default function Footer() {
  const [isCustomer, setIsCustomer] = useState(true)
  const [isInApp, setIsInApp] = useState(false)

  useEffect(() => {
    setIsCustomer(getRole() === 'customer')
    const w = window as any
    setIsInApp(!!(w.ReactNativeWebView || w.webkit?.messageHandlers?.ReactNativeWebView))
  }, [])

  return (
    <footer className="dd-footer">
      <style>{`
        .dd-footer {
          background: #1A1A2E;
          color: white;
          padding: 1.75rem 1rem 1rem;
        }
        .dd-footer-logo {
          height: 56px;
        }
        .dd-footer-tagline {
          font-size: 0.75rem;
          margin-top: 0.5rem;
        }
        .dd-footer-heading {
          font-weight: 700;
          margin-bottom: 0.4rem;
          font-size: 0.8rem;
          letter-spacing: 0.02em;
        }
        .dd-footer-link {
          color: rgba(255,255,255,0.6);
          font-size: 0.78rem;
          text-decoration: none;
          line-height: 1.7;
          padding-left: 0.85rem;
          text-indent: -0.85rem;
          display: block;
        }
        .dd-footer-link::before {
          content: '• ';
          color: rgba(255,255,255,0.35);
        }
        .dd-footer-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          text-align: left;
        }
        @media (min-width: 768px) {
          .dd-footer {
            padding: 2.5rem 1.5rem 1.5rem;
          }
          .dd-footer-logo {
            height: 80px;
          }
          .dd-footer-tagline {
            font-size: 0.8rem;
          }
          .dd-footer-heading {
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
          }
          .dd-footer-link {
            font-size: 0.85rem;
            line-height: 1.8;
            padding-left: 0;
            text-indent: 0;
          }
          .dd-footer-link::before {
            content: none;
          }
          .dd-footer-grid {
            gap: 2rem 3rem;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <Link href="/">
            <img src="/DonutDashfooterlogo.png" alt="DonutDash" className="dd-footer-logo" style={{ width: 'auto', filter: 'brightness(1.1)', display: 'block', margin: '0 auto' }} />
          </Link>
          <p className="dd-footer-tagline" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, maxWidth: '320px', margin: '0.5rem auto 0' }}>
            Delicious donuts delivered fast to your door.
          </p>
          {!isInApp && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href="https://apps.apple.com/us/app/donutdash-donut-delivery/id6762573707"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store"
                  style={{ height: '34px' }}
                />
              </a>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
                Android coming soon
              </span>
            </div>
          )}
        </div>

        {/* Links grid — 3 columns */}
        <div className="dd-footer-grid">
          <div>
            <h4 className="dd-footer-heading">Browse</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link href="/shops" className="dd-footer-link">Browse Shops</Link>
              <Link href="/orders" className="dd-footer-link">My Orders</Link>
              <Link href="/cart" className="dd-footer-link">Cart</Link>
              <Link href="/support" className="dd-footer-link">Customer Help</Link>
              {!isCustomer && (
                <>
                  <Link href="/support/shops" className="dd-footer-link">Shop Support</Link>
                  <Link href="/support/drivers" className="dd-footer-link">Driver Support</Link>
                </>
              )}
            </div>
          </div>

          <div>
            <h4 className="dd-footer-heading">Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link href="/about" className="dd-footer-link">About Us</Link>
              <Link href="/terms" className="dd-footer-link">Terms</Link>
              <Link href="/privacy" className="dd-footer-link">Privacy</Link>
              <Link href="/sms-consent" className="dd-footer-link">SMS Consent</Link>
              {!isCustomer && <Link href="/contractor-agreement" className="dd-footer-link">Contractor Agreement</Link>}
              <a href="https://www.facebook.com/profile.php?id=61575586874091" target="_blank" rel="noopener noreferrer" className="dd-footer-link">
                Facebook
              </a>
            </div>
          </div>

          <div>
            <h4 className="dd-footer-heading">For Business</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Prospective shop owners / drivers should land on the signup
                  form with the right role preselected — NOT on the gated
                  /shop or /driver dashboards (those redirect to a sign-in
                  wall for non-shop_owner / non-driver visitors). */}
              <Link href="/signup?role=shop_owner" className="dd-footer-link">List Your Donut Shop with Us</Link>
              <Link href="/signup?role=driver" className="dd-footer-link">Be a DonutDash Driver</Link>
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
