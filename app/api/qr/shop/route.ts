import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

// Generate QR code for a shop's claim/signup URL
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || ''
  const id = req.nextUrl.searchParams.get('id') || ''
  const type = req.nextUrl.searchParams.get('type') || 'claim' // claim or order

  let url: string
  if (type === 'order' && slug) {
    url = `https://donutdash.app/shops/${slug}`
  } else if (slug) {
    url = `https://donutdash.app/shops/claim/${slug}`
  } else if (id) {
    url = `https://donutdash.app/login?claim=${id}`
  } else {
    url = 'https://donutdash.app/partner-setup'
  }

  const size = parseInt(req.nextUrl.searchParams.get('size') || '300')
  const color = req.nextUrl.searchParams.get('color') || '#FF8C00'

  const qrBuffer = await QRCode.toBuffer(url, {
    width: Math.min(size, 600),
    margin: 2,
    color: { dark: color, light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })

  return new NextResponse(new Uint8Array(qrBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
