const rateLimit = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimit.get(key)

  // Clean up expired entries periodically
  if (rateLimit.size > 10000) {
    for (const [k, v] of rateLimit.entries()) {
      if (v.resetAt < now) rateLimit.delete(k)
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  entry.count++
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: limit - entry.count }
}
