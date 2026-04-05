import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'tilou'
  const url = `https://donutdash.app/card/${slug}`

  const qrBuffer = await QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: { dark: '#FF1493', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  return new NextResponse(new Uint8Array(qrBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
