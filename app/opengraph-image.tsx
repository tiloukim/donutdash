import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'DonutDash - Donut Delivery in Tyler and East Texas'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#C3E96E',
          fontFamily: 'sans-serif',
          padding: '40px',
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://www.donutdash.app/OG-LOG-new.png"
          alt="DonutDash"
          width={500}
          height={160}
          style={{ objectFit: 'contain', marginBottom: '30px' }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: '42px',
            fontWeight: 800,
            color: '#1A1A2E',
            textAlign: 'center',
            lineHeight: 1.3,
            marginBottom: '16px',
          }}
        >
          Donut Delivery in Tyler and East Texas
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#FF1493',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          Fresh Donuts | Delivered Fast
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: '22px',
            fontWeight: 500,
            color: '#555',
            textAlign: 'center',
          }}
        >
          www.donutdash.app
        </div>
      </div>
    ),
    { ...size }
  )
}
