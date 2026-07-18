import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service - DonutDash',
  description: 'DonutDash Terms of Service - Read our terms and conditions for using the DonutDash platform.',
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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
          Effective Date: April 1, 2026 &middot; Last Updated: July 18, 2026
        </p>

        {/* 1 */}
        <h2 style={headingStyle}>1. Acceptance of Terms</h2>
        <p style={paragraphStyle}>
          Welcome to DonutDash. By accessing or using the DonutDash website (<a href="https://donutdash.app" style={{ color: '#FF8C00' }}>donutdash.app</a>), mobile application, or any related services (collectively, the &ldquo;Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please do not use the Platform.
        </p>
        <p style={paragraphStyle}>
          These Terms constitute a legally binding agreement between you and DonutDash Technologies LLC (&ldquo;DonutDash,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a Texas limited liability company located in Tyler, Texas.
        </p>

        {/* 2 */}
        <h2 style={headingStyle}>2. Description of Service</h2>
        <p style={paragraphStyle}>
          DonutDash is a food delivery platform that connects customers with local donut shops and independent delivery drivers. We facilitate the ordering, payment, and delivery process but do not ourselves prepare, manufacture, or deliver food products. Donut shops listed on our Platform are independent businesses, and delivery drivers are independent contractors.
        </p>

        {/* 3 */}
        <h2 style={headingStyle}>3. User Accounts</h2>
        <p style={paragraphStyle}>
          The Platform serves three types of users:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}><strong>Customers:</strong> Individuals who browse menus, place orders, and receive deliveries.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Shop Owners:</strong> Donut shop operators who list products, manage menus, and fulfill orders through the Platform.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong>Drivers:</strong> Independent contractors who pick up and deliver orders to customers.</li>
        </ul>
        <p style={paragraphStyle}>
          To use certain features, you must create an account and provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to create an account.
        </p>

        {/* 4 */}
        <h2 style={headingStyle}>4. Orders and Payments</h2>
        <p style={paragraphStyle}>
          All payments on the Platform are processed through Square, our third-party payment processor. By placing an order, you authorize DonutDash and Square to charge your selected payment method for the total order amount, including item prices, delivery fees, taxes, and any applicable service fees.
        </p>
        <p style={paragraphStyle}>
          DonutDash charges a platform commission on orders placed through the Platform. Prices displayed on the Platform are set by the individual shops and may differ from in-store prices. All prices are listed in US dollars.
        </p>
        <p style={paragraphStyle}>
          You agree that once an order is confirmed, you are obligated to pay the full amount. Failure to pay may result in suspension or termination of your account.
        </p>

        {/* 5 */}
        <h2 style={headingStyle}>5. Delivery</h2>
        <p style={paragraphStyle}>
          Deliveries are performed by independent contractor drivers who are not employees, agents, or representatives of DonutDash. Delivery times provided on the Platform are estimates only and are not guaranteed. DonutDash is not responsible for delays caused by traffic, weather, shop preparation times, or other circumstances beyond our control.
        </p>
        <p style={paragraphStyle}>
          Drivers are responsible for their own vehicles, insurance, and compliance with applicable traffic and food safety laws. DonutDash does not assume liability for the actions or omissions of delivery drivers.
        </p>

        {/* 6 */}
        <h2 style={headingStyle}>6. Cancellations and Refunds</h2>
        <p style={paragraphStyle}>
          Customers may cancel an order before the shop begins preparing it. Once preparation has started, cancellations may not be possible, and refunds will be issued at DonutDash&rsquo;s discretion.
        </p>
        <p style={paragraphStyle}>
          If you receive an incorrect or damaged order, please contact us within 24 hours. We will review your claim and may issue a full or partial refund, credit, or replacement at our discretion.
        </p>
        <p style={paragraphStyle}>
          Refunds are processed back to the original payment method and may take 5&ndash;10 business days to appear on your statement.
        </p>

        {/* 7 */}
        <h2 style={headingStyle}>7. User Conduct</h2>
        <p style={paragraphStyle}>
          You agree not to:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>Use the Platform for any unlawful purpose or in violation of these Terms.</li>
          <li style={{ marginBottom: '0.5rem' }}>Provide false or misleading information in your account or orders.</li>
          <li style={{ marginBottom: '0.5rem' }}>Harass, abuse, or threaten other users, shop owners, or drivers.</li>
          <li style={{ marginBottom: '0.5rem' }}>Attempt to gain unauthorized access to the Platform or its systems.</li>
          <li style={{ marginBottom: '0.5rem' }}>Use automated systems, bots, or scrapers to access the Platform.</li>
          <li style={{ marginBottom: '0.5rem' }}>Interfere with or disrupt the Platform&rsquo;s operation or infrastructure.</li>
          <li style={{ marginBottom: '0.5rem' }}>Resell or commercially exploit orders placed through the Platform without authorization.</li>
        </ul>
        <p style={paragraphStyle}>
          Violation of these rules may result in account suspension or termination at our sole discretion.
        </p>

        {/* 8 */}
        <h2 style={headingStyle}>8. Intellectual Property</h2>
        <p style={paragraphStyle}>
          All content on the Platform, including but not limited to the DonutDash name, logo, trademarks, text, graphics, software, and design, is the property of DonutDash Technologies LLC or its licensors and is protected by copyright, trademark, and other intellectual property laws.
        </p>
        <p style={paragraphStyle}>
          You may not copy, reproduce, modify, distribute, or create derivative works from any content on the Platform without our prior written consent. Shop owners retain ownership of their product images and descriptions but grant DonutDash a non-exclusive license to display such content on the Platform.
        </p>

        {/* 9 */}
        <h2 style={headingStyle}>9. Limitation of Liability</h2>
        <p style={paragraphStyle}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DONUTDASH, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM.
        </p>
        <p style={paragraphStyle}>
          DONUTDASH&rsquo;S TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID TO DONUTDASH IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>
        <p style={paragraphStyle}>
          DonutDash does not guarantee the quality, safety, or accuracy of food products listed on the Platform. Shops are solely responsible for food preparation, allergen information, and compliance with health and safety regulations.
        </p>

        {/* 10 */}
        <h2 style={headingStyle}>10. Indemnification</h2>
        <p style={paragraphStyle}>
          You agree to indemnify, defend, and hold harmless DonutDash Technologies LLC, its officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&rsquo; fees) arising out of or related to your use of the Platform, your violation of these Terms, or your violation of any rights of a third party.
        </p>

        {/* 11 */}
        <h2 style={headingStyle}>11. Governing Law</h2>
        <p style={paragraphStyle}>
          These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law principles. Any legal action or proceeding arising out of or relating to these Terms or the Platform shall be brought exclusively in the state or federal courts located in Smith County, Texas, and you consent to the personal jurisdiction of such courts.
        </p>

        {/* 12 */}
        <h2 style={headingStyle}>12. Changes to Terms</h2>
        <p style={paragraphStyle}>
          We reserve the right to modify these Terms at any time. When we make changes, we will update the &ldquo;Last Updated&rdquo; date at the top of this page. Your continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
        </p>

        {/* 13 */}
        <h2 style={headingStyle}>13. Contact Information</h2>
        <p style={paragraphStyle}>
          If you have any questions about these Terms of Service, please contact us:
        </p>
        <p style={paragraphStyle}>
          <strong>DonutDash Technologies LLC</strong><br />
          Tyler, Texas<br />
          Website: <a href="https://donutdash.app" style={{ color: '#FF8C00' }}>donutdash.app</a><br />
          Email: support@donutdash.app
        </p>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #eee', color: '#999', fontSize: '0.85rem' }}>
          Last updated: July 18, 2026
        </div>
      </div>
    </div>
  )
}
