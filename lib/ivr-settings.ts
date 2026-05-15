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
  tts_voice: string
  greeting: string
  option_label_0: string
  option_label_2: string
  option_label_3: string
  option_label_4: string
  voicemail_prompt: string
}

export const DEFAULT_GREETING = 'Thank you for calling DonutDash, delicious donuts delivered fast!'
export const DEFAULT_OPTION_LABEL_0 = 'a representative'
export const DEFAULT_OPTION_LABEL_2 = 'customer support'
export const DEFAULT_OPTION_LABEL_3 = 'driver support'
export const DEFAULT_OPTION_LABEL_4 = 'partner your donut shop with DonutDash'
export const DEFAULT_VOICEMAIL_PROMPT = "Please leave a message after the beep. When you're done, press the pound key to send."
export const DEFAULT_VOICE = 'Azure.en-US-JennyNeural'

export const TTS_VOICE_OPTIONS = [
  { value: 'Azure.en-US-JennyNeural', label: 'Jenny (Warm female, default)' },
  { value: 'Azure.en-US-AriaNeural', label: 'Aria (Professional female)' },
  { value: 'Azure.en-US-SaraNeural', label: 'Sara (Cheerful female)' },
  { value: 'Azure.en-US-DavisNeural', label: 'Davis (Warm male)' },
  { value: 'Azure.en-US-GuyNeural', label: 'Guy (Clear male)' },
  { value: 'Azure.en-US-TonyNeural', label: 'Tony (Friendly male)' },
  { value: 'Azure.en-US-ChristopherNeural', label: 'Christopher (Professional male)' },
  { value: 'Polly.Joanna', label: 'Joanna (Polly, professional female)' },
  { value: 'Polly.Matthew', label: 'Matthew (Polly, professional male)' },
  { value: 'alice', label: 'Alice (Basic Telnyx default — robotic)' },
] as const

export const DEFAULT_IVR: IvrSettings = {
  forward_number: process.env.IVR_FORWARD_NUMBER || '+19033455599',
  forward_number_0: null,
  forward_number_2: null,
  forward_number_3: null,
  forward_number_4: null,
  business_hours_start: 7,
  business_hours_end: 17,
  dial_timeout_seconds: 20,
  tts_voice: DEFAULT_VOICE,
  greeting: DEFAULT_GREETING,
  option_label_0: DEFAULT_OPTION_LABEL_0,
  option_label_2: DEFAULT_OPTION_LABEL_2,
  option_label_3: DEFAULT_OPTION_LABEL_3,
  option_label_4: DEFAULT_OPTION_LABEL_4,
  voicemail_prompt: DEFAULT_VOICEMAIL_PROMPT,
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
      tts_voice: data?.tts_voice || DEFAULT_VOICE,
      greeting: data?.greeting || DEFAULT_GREETING,
      option_label_0: data?.option_label_0 || DEFAULT_OPTION_LABEL_0,
      option_label_2: data?.option_label_2 || DEFAULT_OPTION_LABEL_2,
      option_label_3: data?.option_label_3 || DEFAULT_OPTION_LABEL_3,
      option_label_4: data?.option_label_4 || DEFAULT_OPTION_LABEL_4,
      voicemail_prompt: data?.voicemail_prompt || DEFAULT_VOICEMAIL_PROMPT,
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
