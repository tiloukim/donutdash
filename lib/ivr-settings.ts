import { createServiceClient } from '@/lib/supabase/server'

export interface IvrSettings {
  forward_number: string
  forward_number_0: string | null
  forward_number_2: string | null
  forward_number_3: string | null
  forward_number_4: string | null
  business_hours_start: number
  business_hours_end: number
  dial_timeout_seconds: number
}

export const DEFAULT_IVR: IvrSettings = {
  forward_number: process.env.IVR_FORWARD_NUMBER || '+19033455599',
  forward_number_0: null,
  forward_number_2: null,
  forward_number_3: null,
  forward_number_4: null,
  business_hours_start: 7,
  business_hours_end: 17,
  dial_timeout_seconds: 20,
}

// Returns the forward number for a specific menu digit, falling back to the
// global forward_number if the per-option override is null/empty.
export function forwardFor(settings: IvrSettings, digit: '0' | '2' | '3' | '4'): string {
  const key = `forward_number_${digit}` as keyof IvrSettings
  const v = settings[key] as string | null | undefined
  return (v && v.trim()) || settings.forward_number
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
      forward_number_0: data?.forward_number_0 ?? null,
      forward_number_2: data?.forward_number_2 ?? null,
      forward_number_3: data?.forward_number_3 ?? null,
      forward_number_4: data?.forward_number_4 ?? null,
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
