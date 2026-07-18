'use client'

import Link from 'next/link'

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

export default function ContractorAgreementPage() {
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

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#1A1A2E',
            marginBottom: '0.5rem',
            lineHeight: 1.2,
          }}
        >
          Independent Contractor Agreement
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Effective Date: April 1, 2026
        </p>

        {/* 1. Parties */}
        <h2 style={headingStyle}>1. Parties</h2>
        <p style={paragraphStyle}>
          This Independent Contractor Agreement (&quot;Agreement&quot;) is entered into between{' '}
          <strong>DonutDash Technologies LLC</strong> (&quot;Company&quot;), a Texas limited liability company
          with its principal place of business in Tyler, Texas, and the individual who accepts this
          Agreement through the DonutDash platform (&quot;Contractor&quot; or &quot;Driver&quot;).
        </p>
        <p style={paragraphStyle}>
          By accepting delivery assignments through the DonutDash platform, Contractor acknowledges
          that they have read, understood, and agree to the terms of this Agreement.
        </p>

        {/* 2. Independent Contractor Status */}
        <h2 style={headingStyle}>2. Independent Contractor Status</h2>
        <p style={paragraphStyle}>
          Contractor is an independent contractor and is <strong>not</strong> an employee, agent,
          partner, or joint venturer of the Company. Nothing in this Agreement shall be construed to
          create an employment relationship between the parties.
        </p>
        <p style={paragraphStyle}>
          As an independent contractor, Contractor shall not be entitled to any employee benefits,
          including but not limited to: health insurance, workers&apos; compensation, unemployment
          insurance, retirement benefits, paid leave, or any other benefits that the Company provides
          to its employees. The Company will not withhold federal, state, or local income taxes,
          Social Security, or Medicare taxes from payments made to Contractor. Contractor is solely
          responsible for all tax obligations, including self-employment taxes, and shall receive an
          IRS Form 1099-NEC for compensation exceeding the applicable threshold.
        </p>

        {/* 3. Services */}
        <h2 style={headingStyle}>3. Services</h2>
        <p style={paragraphStyle}>
          Contractor agrees to provide delivery services for food orders placed through the DonutDash
          platform. Services include picking up orders from participating donut shops and other food
          establishments, and delivering them to customers at designated locations in a timely and
          professional manner.
        </p>
        <p style={paragraphStyle}>
          Contractor retains full discretion over when, where, and how long they choose to make
          themselves available on the DonutDash platform. Contractor may accept or decline any
          delivery request without penalty.
        </p>

        {/* 4. Compensation */}
        <h2 style={headingStyle}>4. Compensation</h2>
        <p style={paragraphStyle}>
          Contractor shall be compensated on a per-delivery basis. Compensation for each delivery
          consists of:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Base pay</strong> for each completed delivery, as displayed in the DonutDash
            driver application at the time the delivery is offered.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Per-mile compensation</strong> based on the distance between the pickup and
            drop-off locations.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Tips</strong> from customers, which are passed through to the Contractor in full
            (100%).
          </li>
        </ul>
        <p style={paragraphStyle}>
          The Company reserves the right to modify the compensation structure at any time with
          reasonable notice to Contractor through the DonutDash platform.
        </p>

        {/* 5. Expenses */}
        <h2 style={headingStyle}>5. Expenses</h2>
        <p style={paragraphStyle}>
          Contractor is solely responsible for all expenses incurred in the performance of delivery
          services, including but not limited to: the cost and maintenance of a personal vehicle,
          gasoline, tolls, parking, mobile phone and data plan, and any other expenses related to the
          delivery services. The Company shall not reimburse Contractor for any such expenses.
        </p>

        {/* 6. Insurance and Licensing Requirements */}
        <h2 style={headingStyle}>6. Insurance and Licensing Requirements</h2>
        <p style={paragraphStyle}>
          Contractor must maintain, at their own expense, the following at all times while performing
          delivery services:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            A valid driver&apos;s license issued by the state in which Contractor operates.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Active automobile liability insurance meeting or exceeding the minimum coverage
            requirements of the state in which Contractor operates.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Current vehicle registration for the vehicle used for deliveries.
          </li>
        </ul>
        <p style={paragraphStyle}>
          Contractor agrees to provide proof of all required documentation upon request and to
          promptly notify the Company if any required license or insurance coverage lapses or is
          revoked.
        </p>

        {/* 7. Non-Exclusivity */}
        <h2 style={headingStyle}>7. Non-Exclusivity</h2>
        <p style={paragraphStyle}>
          This Agreement is non-exclusive. Contractor is free to provide delivery services or other
          services for other companies, platforms, or clients, including but not limited to DoorDash,
          UberEats, Grubhub, Instacart, and any other delivery or rideshare platforms. Nothing in
          this Agreement restricts Contractor from engaging in any other business activities.
        </p>

        {/* 8. Confidentiality */}
        <h2 style={headingStyle}>8. Confidentiality</h2>
        <p style={paragraphStyle}>
          Contractor acknowledges that, in the course of performing delivery services, they may have
          access to confidential information including customer names, addresses, phone numbers,
          order details, and other personal information. Contractor agrees to:
        </p>
        <ul style={{ ...paragraphStyle, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            Keep all customer information strictly confidential and use it only for the purpose of
            completing deliveries.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Not share, sell, or disclose customer information to any third party.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Not contact customers for any purpose other than completing an active delivery.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Delete or destroy any customer information in their possession upon completion of each
            delivery.
          </li>
        </ul>

        {/* 9. Termination */}
        <h2 style={headingStyle}>9. Termination</h2>
        <p style={paragraphStyle}>
          Either party may terminate this Agreement at any time, with or without cause, and with or
          without notice. Upon termination, Contractor shall cease all use of the DonutDash platform
          and return or destroy any Company property or confidential information in their possession.
          The Company shall pay Contractor for all completed deliveries up to the date of
          termination.
        </p>

        {/* 10. Indemnification */}
        <h2 style={headingStyle}>10. Indemnification</h2>
        <p style={paragraphStyle}>
          Contractor agrees to indemnify, defend, and hold harmless the Company, its officers,
          directors, employees, and agents from and against any and all claims, damages, losses,
          liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of
          or related to: (a) Contractor&apos;s performance of delivery services; (b) any breach of
          this Agreement by Contractor; (c) any accident, injury, or property damage caused by
          Contractor during the performance of delivery services; or (d) Contractor&apos;s failure to
          comply with applicable laws and regulations.
        </p>

        {/* 11. Governing Law */}
        <h2 style={headingStyle}>11. Governing Law</h2>
        <p style={paragraphStyle}>
          This Agreement shall be governed by and construed in accordance with the laws of the State
          of Texas, without regard to its conflict of laws principles. Any disputes arising under
          this Agreement shall be resolved in the courts located in Smith County, Texas.
        </p>

        {/* 12. Entire Agreement */}
        <h2 style={headingStyle}>12. Entire Agreement</h2>
        <p style={paragraphStyle}>
          This Agreement constitutes the entire agreement between the parties with respect to the
          subject matter hereof and supersedes all prior agreements, understandings, negotiations,
          and discussions, whether oral or written. This Agreement may be amended only by a written
          instrument signed by both parties or by the Company providing updated terms through the
          DonutDash platform.
        </p>

        {/* 13. Contact */}
        <h2 style={headingStyle}>13. Contact Information</h2>
        <p style={paragraphStyle}>
          For questions about this Agreement, please contact:
        </p>
        <div
          style={{
            background: '#FFF8F0',
            borderRadius: '10px',
            padding: '1.25rem',
            border: '1px solid #FFE8D6',
            marginBottom: '2rem',
          }}
        >
          <p style={{ ...paragraphStyle, marginBottom: '0.25rem', fontWeight: 600 }}>
            DonutDash Technologies LLC
          </p>
          <p style={{ ...paragraphStyle, marginBottom: '0.25rem' }}>Tyler, TX</p>
          <p style={{ ...paragraphStyle, marginBottom: 0 }}>
            Email:{' '}
            <a href="mailto:support@donutdash.app" style={{ color: '#FF8C00' }}>
              support@donutdash.app
            </a>
          </p>
        </div>

        {/* Print / Save button */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'DonutDash Contractor Agreement', url: window.location.href })
              } else {
                window.print()
              }
            }}
            style={{
              background: '#FF8C00',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E07B00')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FF8C00')}
          >
            Save / Print Agreement
          </button>
        </div>
      </div>
    </div>
  )
}
