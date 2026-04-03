import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - DonutDash',
  description: 'DonutDash Privacy Policy - Learn how we collect, use, and protect your personal information.',
}

const headingStyle = {
  color: '#FF8C00',
  fontWeight: 700 as const,
  marginTop: '2.5rem',
  marginBottom: '1rem',
  fontSize: '1.35rem',
  lineHeight: 1.3,
}

const paragraphStyle = {
  color: '#333',
  lineHeight: 1.8,
  marginBottom: '1rem',
  fontSize: '0.95rem',
}

export default function PrivacyPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#FF8C00',
            fontSize: '0.9rem',
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: '2rem',
          }}
        >
          &larr; Back to DonutDash
        </Link>

        <h1 style={{ color: '#FF8C00', fontSize: '2.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 1, 2026
        </p>

        <p style={paragraphStyle}>
          KIMCO LLC, doing business as DonutDash (&ldquo;DonutDash,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the DonutDash website (<a href="https://donutdash.app" style={{ color: '#FF8C00' }}>donutdash.app</a>), mobile application, and related services (collectively, the &ldquo;Platform&rdquo;).
        </p>

        {/* 1 */}
        <h2 style={headingStyle}>1. Information We Collect</h2>
        <p style={paragraphStyle}>
          We collect the following types of information:
        </p>
        <p style={{ ...paragraphStyle, fontWeight: 600 }}>Information You Provide:</p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Account information:</strong> Name, email address, phone number, and password.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Delivery information:</strong> Street address, apartment or unit number, and delivery instructions.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Payment information:</strong> Credit or debit card details, processed securely through Square. We do not store your full card number on our servers.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Profile information:</strong> Profile photos, preferences, and dietary notes.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Communications:</strong> Messages you send through the Platform, customer support inquiries, and feedback.</li>
        </ul>
        <p style={{ ...paragraphStyle, fontWeight: 600 }}>Information Collected Automatically:</p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Location data:</strong> GPS coordinates from your device (with your permission) used for delivery address suggestions and driver tracking.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Device information:</strong> Browser type, operating system, device identifiers, and IP address.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Usage data:</strong> Pages visited, features used, order history, and interaction patterns.</li>
        </ul>

        {/* 2 */}
        <h2 style={headingStyle}>2. How We Use Your Information</h2>
        <p style={paragraphStyle}>
          We use the information we collect for the following purposes:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Process orders:</strong> To facilitate ordering, payment processing, and order fulfillment.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Delivery coordination:</strong> To connect customers with drivers and provide real-time delivery tracking.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Communications:</strong> To send order confirmations, delivery updates, promotional offers, and customer support responses via email (Resend) and SMS (Twilio).</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Platform improvement:</strong> To analyze usage patterns, improve our services, and develop new features.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Safety and security:</strong> To detect and prevent fraud, abuse, and unauthorized access.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Legal compliance:</strong> To comply with applicable laws, regulations, and legal processes.</li>
        </ul>

        {/* 3 */}
        <h2 style={headingStyle}>3. Information Sharing</h2>
        <p style={paragraphStyle}>
          We share your information with the following parties as necessary to operate the Platform:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Donut shops:</strong> Your name, order details, and delivery address are shared with shops to prepare and fulfill your orders.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Delivery drivers:</strong> Your name, delivery address, phone number, and delivery instructions are shared with drivers to complete deliveries.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Square:</strong> Payment information is shared with Square for secure payment processing.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Twilio:</strong> Your phone number is shared with Twilio to send SMS notifications about your orders.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Resend:</strong> Your email address is shared with Resend for transactional and marketing email delivery.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Analytics providers:</strong> Anonymized usage data may be shared with analytics services to improve the Platform.</li>
        </ul>
        <p style={paragraphStyle}>
          We do not sell your personal information to third parties. We may disclose your information if required by law, court order, or governmental regulation, or if necessary to protect our rights, property, or safety.
        </p>

        {/* 4 */}
        <h2 style={headingStyle}>4. Location Data</h2>
        <p style={paragraphStyle}>
          We collect and use location data in the following ways:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Customers:</strong> With your permission, we use your device&rsquo;s GPS to suggest delivery addresses and show nearby shops.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Drivers:</strong> GPS tracking is used during active deliveries to provide real-time location updates to customers and to optimize delivery routes. Driver location is only tracked and shared while a delivery is in progress.</li>
        </ul>
        <p style={paragraphStyle}>
          You can disable location services through your device settings, though this may affect certain Platform features.
        </p>

        {/* 5 */}
        <h2 style={headingStyle}>5. Cookies and Tracking</h2>
        <p style={paragraphStyle}>
          We use cookies and similar tracking technologies to:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>Keep you signed in to your account.</li>
          <li style={{ marginBottom: '0.5rem' }}>Remember your preferences and cart contents.</li>
          <li style={{ marginBottom: '0.5rem' }}>Analyze Platform usage and performance.</li>
          <li style={{ marginBottom: '0.5rem' }}>Deliver relevant promotional content.</li>
        </ul>
        <p style={paragraphStyle}>
          You can control cookies through your browser settings. Disabling cookies may limit your ability to use certain features of the Platform.
        </p>

        {/* 6 */}
        <h2 style={headingStyle}>6. Data Security</h2>
        <p style={paragraphStyle}>
          We implement industry-standard security measures to protect your personal information, including encryption of data in transit (TLS/SSL), secure password hashing, and access controls. Payment information is processed through Square&rsquo;s PCI-compliant infrastructure and is not stored on our servers.
        </p>
        <p style={paragraphStyle}>
          While we strive to protect your information, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but will notify affected users in the event of a data breach as required by applicable law.
        </p>

        {/* 7 */}
        <h2 style={headingStyle}>7. Data Retention</h2>
        <p style={paragraphStyle}>
          We retain your personal information for as long as your account is active or as needed to provide you services. Order history and transaction records are retained for a minimum of seven (7) years for tax and legal compliance purposes. If you request account deletion, we will delete or anonymize your personal information within 30 days, except where retention is required by law.
        </p>

        {/* 8 */}
        <h2 style={headingStyle}>8. Your Rights</h2>
        <p style={paragraphStyle}>
          You have the following rights regarding your personal information:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Access:</strong> You may request a copy of the personal information we hold about you.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Correction:</strong> You may update or correct inaccurate information through your account settings or by contacting us.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Deletion:</strong> You may request deletion of your account and associated personal information.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Opt-out:</strong> You may opt out of marketing communications at any time by using the unsubscribe link in our emails or contacting us.</li>
        </ul>
        <p style={paragraphStyle}>
          To exercise any of these rights, please contact us at support@donutdash.app. We will respond to your request within 30 days.
        </p>

        {/* 9 */}
        <h2 style={headingStyle}>9. Children&rsquo;s Privacy</h2>
        <p style={paragraphStyle}>
          The Platform is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected information from a child under 18, we will take steps to delete that information promptly. If you believe a child has provided us with personal information, please contact us at support@donutdash.app.
        </p>

        {/* 10 */}
        <h2 style={headingStyle}>10. California and Texas Privacy Rights</h2>
        <p style={paragraphStyle}>
          <strong>California Residents:</strong> Under the California Consumer Privacy Act (CCPA), California residents have additional rights, including the right to know what personal information is collected, the right to request deletion, and the right to opt out of the sale of personal information. As stated above, we do not sell personal information. To exercise your CCPA rights, contact us at support@donutdash.app.
        </p>
        <p style={paragraphStyle}>
          <strong>Texas Residents:</strong> Under the Texas Data Privacy and Security Act (TDPSA), Texas residents have the right to access, correct, delete, and obtain a copy of their personal data, as well as the right to opt out of targeted advertising and the sale of personal data. To exercise these rights, contact us at support@donutdash.app. We will respond within 45 days.
        </p>

        {/* 11 */}
        <h2 style={headingStyle}>11. Changes to This Policy</h2>
        <p style={paragraphStyle}>
          We may update this Privacy Policy from time to time. When we make changes, we will update the &ldquo;Last Updated&rdquo; date at the top of this page. For significant changes, we may also notify you by email or through a notice on the Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the updated policy.
        </p>

        {/* 12 */}
        <h2 style={headingStyle}>12. Contact Information</h2>
        <p style={paragraphStyle}>
          If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
        </p>
        <p style={paragraphStyle}>
          <strong>KIMCO LLC (d/b/a DonutDash)</strong><br />
          Tyler, Texas<br />
          Website: <a href="https://donutdash.app" style={{ color: '#FF8C00' }}>donutdash.app</a><br />
          Email: support@donutdash.app
        </p>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #eee', color: '#999', fontSize: '0.85rem' }}>
          Last updated: April 1, 2026
        </div>
      </div>
    </div>
  )
}
