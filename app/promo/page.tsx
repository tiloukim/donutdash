export default function PromoGraphics() {
  return (
    <div style={{ background: '#f5f5f5', padding: 40, display: 'flex', flexDirection: 'column', gap: 60, alignItems: 'center' }}>
      <h1 style={{ fontSize: 24, color: '#333' }}>Social Media Graphics — Screenshot These</h1>

      {/* 1. Driver Recruitment */}
      <div id="driver-recruit" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 100%)',
        borderRadius: 0, padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, marginBottom: 12 }}>JOIN DONUTDASH</div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1 }}>Drive & Earn<br/>On Your<br/>Schedule</div>
        </div>
        <div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
            {['Flexible Hours', 'Weekly Pay', 'Keep 100% Tips'].map(t => (
              <div key={t} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '14px 24px', fontSize: 22, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>donutdash.app/driver</div>
              <div style={{ fontSize: 20, opacity: 0.8, marginTop: 4 }}>Sign up today — Tyler, TX</div>
            </div>
            <div style={{ fontSize: 80 }}>🚗</div>
          </div>
        </div>
      </div>

      {/* 2. Driver Referral $20 */}
      <div id="driver-referral" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, marginBottom: 12 }}>DRIVER REFERRAL</div>
          <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.1 }}>Earn $20</div>
          <div style={{ fontSize: 36, fontWeight: 600, marginTop: 12 }}>For Every Driver You Refer!</div>
        </div>
        <div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 24, padding: 36, marginBottom: 40, backdropFilter: 'blur(4px)' }}>
            <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>How it works:</div>
            {['Share your referral code with a friend', 'They sign up and start delivering', 'After 10 completed deliveries...', 'You BOTH get $20!'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{i + 1}</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{step}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>donutdash.app/driver</div>
          <div style={{ fontSize: 20, opacity: 0.8, marginTop: 4 }}>Tyler, TX</div>
        </div>
      </div>

      {/* 3. Shop Partner Recruitment */}
      <div id="shop-recruit" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)',
        padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, marginBottom: 12 }}>PARTNER WITH US</div>
          <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.1 }}>List Your<br/>Donut Shop<br/>on DonutDash</div>
        </div>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {[
              { icon: '📱', text: 'Reach more customers online' },
              { icon: '🚗', text: 'We handle the delivery' },
              { icon: '💰', text: 'Keep 85% of every sale' },
              { icon: '📊', text: 'Real-time analytics dashboard' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 36 }}>{item.icon}</span>
                <span style={{ fontSize: 26, fontWeight: 600 }}>{item.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>donutdash.app/shop</div>
          <div style={{ fontSize: 20, opacity: 0.8, marginTop: 4 }}>Free to join — Tyler, TX</div>
        </div>
      </div>

      {/* 4. Shop Referral $100 */}
      <div id="shop-referral" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, marginBottom: 12 }}>SHOP REFERRAL BONUS</div>
          <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1 }}>$100</div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 12 }}>For You AND the<br/>Shop You Refer!</div>
        </div>
        <div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 24, padding: 36, marginBottom: 40, backdropFilter: 'blur(4px)' }}>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6 }}>
              Know a donut shop that should be on DonutDash?<br/>
              Share your referral code. After they complete<br/>
              20 orders, you BOTH earn <strong>$100</strong>!
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '14px 24px', fontSize: 20, fontWeight: 700 }}>Drivers can refer too!</div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '14px 24px', fontSize: 20, fontWeight: 700 }}>Shops can refer shops!</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 24 }}>donutdash.app</div>
        </div>
      </div>

      {/* 5. Customer Referral $5 */}
      <div id="customer-referral" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #F59E0B 0%, #FF8C00 100%)',
        padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9, marginBottom: 12 }}>REFER A FRIEND</div>
          <div style={{ fontSize: 90, fontWeight: 900, lineHeight: 1 }}>Get $5</div>
          <div style={{ fontSize: 36, fontWeight: 600, marginTop: 12 }}>When Your Friend<br/>Orders Their First Donuts!</div>
        </div>
        <div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 28, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>You get $5</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 28, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🍩</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>They get $5</div>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>donutdash.app</div>
          <div style={{ fontSize: 20, opacity: 0.8, marginTop: 4 }}>Fresh donuts delivered — Tyler, TX</div>
        </div>
      </div>

      {/* 6. General - Order Now */}
      <div id="order-now" style={{
        width: 1080, height: 1080, background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2B55 100%)',
        padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,140,0,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,20,147,0.1)' }} />
        <div>
          <div style={{ fontSize: 120, marginBottom: 20 }}>🍩</div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1 }}>Fresh Donuts<br/>Delivered<br/>To Your Door</div>
        </div>
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
            {['Order Online', 'Track Live', 'Enjoy Fast'].map(t => (
              <div key={t} style={{ background: 'rgba(255,140,0,0.3)', borderRadius: 16, padding: '14px 24px', fontSize: 22, fontWeight: 700, border: '1px solid rgba(255,140,0,0.4)' }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FF8C00' }}>donutdash.app</div>
          <div style={{ fontSize: 20, opacity: 0.6, marginTop: 4 }}>Tyler, Texas</div>
        </div>
      </div>

      <p style={{ color: '#888', fontSize: 14, maxWidth: 600, textAlign: 'center' }}>
        To save: Right-click each graphic and select &quot;Save image as...&quot; or take a screenshot.
        Each graphic is 1080x1080px — perfect for Instagram and Facebook posts.
      </p>
    </div>
  )
}
