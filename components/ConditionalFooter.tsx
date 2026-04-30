'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

const HIDE_PATTERNS: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/driver(\/|$)/,
  /^\/shop(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/partner-setup(\/|$)/,
  /^\/login$/,
  /^\/signup$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
]

export default function ConditionalFooter() {
  const pathname = usePathname() || ''
  if (HIDE_PATTERNS.some(p => p.test(pathname))) return null
  return <Footer />
}
