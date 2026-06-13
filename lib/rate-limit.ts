// DB-backed rate limit. The previous in-memory Map didn't survive
// Vercel's serverless model — each invocation got its own counter,
// so an attacker effectively bypassed the limit by hitting different
// instances. The check_rate_limit RPC in supabase/rate-limits.sql
// runs the read-modify-write in one transaction so concurrent calls
// can't both pass at the threshold.
//
// Falls back to an in-memory counter if the DB read fails — better
// than failing open. Memory fallback is per-process (its old broken
// behavior) but only kicks in under DB outage; the steady state is
// the correct global counter.

import { createServiceClient } from './supabase/server'

interface MemoryBucket {
  count: number
  resetAt: number
}
const memoryBuckets = new Map<string, MemoryBucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const svc = createServiceClient()
    const { data, error } = await svc.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    if (error || !data) {
      return checkMemory(key, limit, windowMs)
    }
    return {
      allowed: data.allowed === true,
      remaining: typeof data.remaining === 'number' ? data.remaining : 0,
    }
  } catch {
    return checkMemory(key, limit, windowMs)
  }
}

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memoryBuckets.get(key)
  if (memoryBuckets.size > 10000) {
    for (const [k, v] of memoryBuckets.entries()) {
      if (v.resetAt < now) memoryBuckets.delete(k)
    }
  }
  if (!entry || entry.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  entry.count++
  if (entry.count > limit) return { allowed: false, remaining: 0 }
  return { allowed: true, remaining: limit - entry.count }
}
