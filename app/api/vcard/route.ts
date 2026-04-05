import { NextResponse } from 'next/server'

export async function GET() {
  const vcard = `BEGIN:VCARD
VERSION:3.0
N:Kim;Tony;;;
FN:Tony Kim - DonutDash
ORG:DonutDash
TITLE:Founder
TEL;TYPE=CELL:(903) 345-5599
EMAIL:Donutdash903@gmail.com
URL:https://donutdash.app
ADR;TYPE=WORK:;;Tyler;TX;;;US
NOTE:Fresh donuts delivered fast - donutdash.app
END:VCARD`

  return new NextResponse(vcard, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': 'attachment; filename="Tony-Kim-DonutDash.vcf"',
    },
  })
}
