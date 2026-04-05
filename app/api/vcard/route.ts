import { NextRequest, NextResponse } from 'next/server'
import { getTeamMember, formatPhone, team } from '@/lib/team'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'tony'
  const m = getTeamMember(slug) || team[0]
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nameParts = m.name.split(' ')
  const lastName = nameParts.slice(-1)[0]
  const firstName = nameParts.slice(0, -1).join(' ')
  const phoneFormatted = formatPhone(m.phone)

  const vcard = `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${m.name} - DonutDash
ORG:DonutDash
TITLE:${m.title}
TEL;TYPE=CELL:${phoneFormatted}
EMAIL:${m.email}
URL:https://donutdash.app
ADR;TYPE=WORK:;;Tyler;TX;;;US
NOTE:${m.title} at DonutDash - donutdash.app
END:VCARD`

  const filename = m.name.replace(/\s+/g, '-') + '-DonutDash.vcf'

  return new NextResponse(vcard, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
