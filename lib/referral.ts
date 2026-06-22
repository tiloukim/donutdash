import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// Customer referral program on/off switch.
//
// Stored in dd_platform_settings under `referral_program_enabled`, edited
// from /admin/settings. Defaults to OFF: the program is only active when the
// value is exactly 'true', so a missing key (or anything else) means disabled.
// Gates both the apply endpoint and the $5 award on delivery.
// ============================================================

export async function isReferralProgramEnabled(svc: SupabaseClient): Promise<boolean> {
  const { data } = await svc
    .from('dd_platform_settings')
    .select('value')
    .eq('key', 'referral_program_enabled')
    .maybeSingle()
  return data?.value === 'true'
}
