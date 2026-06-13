// Extract the real client IP from a Vercel request. Prefers
// x-vercel-forwarded-for (set by the Vercel edge — not client-spoofable)
// over x-forwarded-for (leftmost entry is client-supplied so a
// malicious actor can rotate IPs at will and defeat rate limits).

export function getClientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) {
    const first = vercel.split(',')[0]?.trim()
    if (first) return first
  }
  // Fallback: trust the RIGHTMOST entry of XFF (closest to our infra)
  // rather than the leftmost (closest to the client = spoofable).
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return 'unknown'
}
