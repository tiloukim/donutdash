import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SMS Consent & Opt-In Policy - DonutDash',
  description: 'DonutDash SMS notifications consent policy. Learn how we use SMS to send order updates, delivery notifications, and account alerts.',
}

export default function SmsConsentPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 60px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FF8C00', margin: 0 }}>DonutDash™</h1>
          </Link>
          <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>donutdash.app</div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#333', marginBottom: 8 }}>SMS Consent & Opt-In Policy</h2>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>Last updated: April 10, 2026</p>

        {/* What messages */}
        <Section title="What SMS Messages We Send">
          <p>DonutDash sends SMS notifications to keep you informed about your activity on our platform. Messages include:</p>
          <ul>
            <li><strong>Order confirmations</strong> — when your order is placed and confirmed by the shop</li>
            <li><strong>Delivery updates</strong> — when your order is picked up and delivered</li>
            <li><strong>Account alerts</strong> — password resets, security alerts, and account status changes</li>
            <li><strong>Shop owner notifications</strong> — new order alerts and customer messages</li>
            <li><strong>Driver notifications</strong> — delivery assignment and route updates</li>
          </ul>
        </Section>

        {/* How users consent */}
        <Section title="How You Consent to Receive SMS">
          <p>You may opt in to receive SMS notifications during account registration on DonutDash. During signup, you can check an optional consent checkbox that states:</p>
          <div style={{ background: '#FFF8F0', border: '2px solid #FF8C00', borderRadius: 12, padding: '20px 24px', margin: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 20, height: 20, border: '2px solid #FF8C00', borderRadius: 4, background: '#FF8C00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333' }}>
                I agree to receive SMS notifications about my orders, delivery updates, and account alerts.
                Message &amp; data rates may apply. Reply STOP to unsubscribe.
                Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.{' '}
                <Link href="/privacy" style={{ color: '#FF8C00', textDecoration: 'underline' }}>Privacy Policy</Link>
              </p>
            </div>
          </div>
          <p>This checkbox is <strong>optional</strong> — you can create an account without opting in to SMS. The consent form is visible at:</p>
          <ul>
            <li><strong>Customer signup:</strong> <Link href="/signup" style={{ color: '#FF8C00' }}>donutdash.app/signup</Link></li>
            <li><strong>Shop owner signup:</strong> <Link href="/shop" style={{ color: '#FF8C00' }}>donutdash.app/shop</Link> (click &quot;Sign Up&quot;)</li>
            <li><strong>Driver signup:</strong> <Link href="/driver" style={{ color: '#FF8C00' }}>donutdash.app/driver</Link> (click &quot;Sign Up&quot;)</li>
          </ul>
          <p>Users can also text <strong>START</strong> to our number to opt in to messages.</p>
        </Section>

        {/* How to opt out */}
        <Section title="How to Opt Out (Unsubscribe)">
          <p>You can stop receiving SMS messages at any time by:</p>
          <ul>
            <li>Replying <strong>STOP</strong> to any message from DonutDash</li>
            <li>Replying any of these keywords: <strong>STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPTOUT, REVOKE</strong></li>
          </ul>
          <p>After opting out, you will receive a confirmation message:</p>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px', margin: '12px 0', fontStyle: 'italic', color: '#555', fontSize: 14 }}>
            &quot;You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.&quot;
          </div>
        </Section>

        {/* Help */}
        <Section title="Help & Support">
          <p>For help with SMS messages, you can:</p>
          <ul>
            <li>Reply <strong>HELP</strong> or <strong>INFO</strong> to any message from DonutDash</li>
            <li>Email us at <a href="mailto:support@donutdash.app" style={{ color: '#FF8C00' }}>support@donutdash.app</a></li>
          </ul>
          <p>Help response:</p>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px', margin: '12px 0', fontStyle: 'italic', color: '#555', fontSize: 14 }}>
            &quot;DonutDash: Order &amp; delivery notifications. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to unsubscribe. For support visit donutdash.app/support or email help@donutdash.app&quot;
          </div>
        </Section>

        {/* Message frequency */}
        <Section title="Message Frequency & Rates">
          <ul>
            <li><strong>Message frequency varies</strong> based on your order and delivery activity</li>
            <li><strong>Message and data rates may apply</strong> depending on your mobile carrier plan</li>
            <li>DonutDash does not charge for SMS messages, but your carrier may</li>
            <li>Compatible with all major US carriers (AT&T, T-Mobile, Verizon, etc.)</li>
          </ul>
        </Section>

        {/* Data use */}
        <Section title="How We Use Your Phone Number">
          <ul>
            <li>Your phone number is used <strong>only</strong> for sending transactional SMS notifications related to your DonutDash account</li>
            <li>Your mobile information will <strong>not</strong> be sold or shared with third parties for promotional or marketing purposes</li>
            <li>We do <strong>not</strong> send spam or unsolicited messages</li>
            <li>For full details, see our <Link href="/privacy" style={{ color: '#FF8C00' }}>Privacy Policy</Link> and <Link href="/terms" style={{ color: '#FF8C00' }}>Terms of Service</Link></li>
          </ul>
        </Section>

        {/* Screenshots */}
        <Section title="Consent Collection Screenshots">
          <p>Below are examples of how SMS consent is collected during registration:</p>

          <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: 24, marginBottom: 16, background: '#fafafa' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Customer Signup (donutdash.app/signup)</div>
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #eee' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Email</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>customer@example.com</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Phone Number</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>(903) 555-0123</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Password</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>••••••••</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px', background: '#FFF8F0', borderRadius: 8, border: '1px solid #FFD699' }}>
                <div style={{ width: 18, height: 18, border: '2px solid #FF1493', borderRadius: 4, background: '#FF1493', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                  I agree to receive SMS notifications about my orders, delivery updates, and account alerts.
                  Message frequency varies. Message &amp; data rates may apply. Reply HELP for help. Reply STOP to unsubscribe. <span style={{ color: '#FF1493', textDecoration: 'underline' }}>Privacy Policy</span>
                </span>
              </div>
              <div style={{ marginTop: 12, padding: '10px', background: '#FF1493', color: '#fff', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>Create Account</div>
            </div>
          </div>

          <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: 24, background: '#fafafa' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Shop Owner & Driver Signup</div>
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #eee' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Email</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>shopowner@example.com</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Phone Number</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>(903) 555-0456</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Password</label>
                <div style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, color: '#aaa', marginTop: 4 }}>••••••••</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px', background: '#FFF8F0', borderRadius: 8, border: '1px solid #FFD699' }}>
                <div style={{ width: 18, height: 18, border: '2px solid #FF8C00', borderRadius: 4, background: '#FF8C00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                  I agree to receive SMS notifications about my orders, delivery updates, and account alerts.
                  Message frequency varies. Message &amp; data rates may apply. Reply HELP for help. Reply STOP to unsubscribe. <span style={{ color: '#FF8C00', textDecoration: 'underline' }}>Privacy Policy</span>
                </span>
              </div>
              <div style={{ marginTop: 12, padding: '10px', background: '#FF8C00', color: '#fff', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>Create Account</div>
            </div>
          </div>
        </Section>

        {/* Contact */}
        <div style={{ marginTop: 40, padding: '20px 24px', background: '#f5f5f5', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#555' }}>
            <strong>DonutDash</strong> — <a href="https://donutdash.app" style={{ color: '#FF8C00' }}>donutdash.app</a><br />
            Questions? Email <a href="mailto:support@donutdash.app" style={{ color: '#FF8C00' }}>support@donutdash.app</a>
          </p>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FF8C00', marginBottom: 12 }}>{title}</h3>
      <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{children}</div>
      <style>{`
        div ul { padding-left: 24px; margin: 8px 0; }
        div li { margin-bottom: 6px; }
      `}</style>
    </div>
  )
}
