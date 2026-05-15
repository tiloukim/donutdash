import { createServiceClient } from '@/lib/supabase/server'

export interface IvrSettings {
  forward_number: string
  business_hours_start: number
  business_hours_end: number
  dial_timeout_seconds: number
}

export const DEFAULT_IVR: IvrSettings = {
  forward_number: process.env.IVR_FORWARD_NUMBER || '+19033455599',
  business_hours_start: 7,
  business_hours_end: 17,
  dial_timeout_seconds: 20,
}

// Short in-process cache so we don't hit Supabase on every call leg.
let cached: { value: IvrSettings; at: number } | null = null
const TTL_MS = 30_000

export async function getIvrSettings(): Promise<IvrSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  try {
    const svc = createServiceClient()
    const { data } = await svc.from('dd_ivr_settings').select('*').eq('id', 1).maybeSingle()
    const value: IvrSettings = {
      forward_number: data?.forward_number || DEFAULT_IVR.forward_number,
      business_hours_start: data?.business_hours_start ?? DEFAULT_IVR.business_hours_start,
      business_hours_end: data?.business_hours_end ?? DEFAULT_IVR.business_hours_end,
      dial_timeout_seconds: data?.dial_timeout_seconds ?? DEFAULT_IVR.dial_timeout_seconds,
    }
    cached = { value, at: Date.now() }
    return value
  } catch {
    return DEFAULT_IVR
  }
}

export function invalidateIvrCache() {
  cached = null
}
