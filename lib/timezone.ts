// Map a US state abbreviation to its IANA timezone. Order timestamps are stored
// in UTC; receipts/emails must render in the SHOP's local time or they look
// hours off (e.g. an 8:04pm CT order shows as 1:04am UTC). The platform is
// Texas-based, so a missing/unknown state defaults to Central. States that span
// two zones use their majority zone — fine at shop-receipt granularity.
const STATE_TZ: Record<string, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York',
  IN: 'America/New_York', KY: 'America/New_York', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/New_York', NH: 'America/New_York', NJ: 'America/New_York',
  NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York', PA: 'America/New_York',
  RI: 'America/New_York', SC: 'America/New_York', VT: 'America/New_York', VA: 'America/New_York',
  WV: 'America/New_York', DC: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago', IA: 'America/Chicago',
  KS: 'America/Chicago', LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', NE: 'America/Chicago', ND: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', WI: 'America/Chicago',
  // Mountain
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Denver', MT: 'America/Denver',
  NM: 'America/Denver', UT: 'America/Denver', WY: 'America/Denver',
  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles', OR: 'America/Los_Angeles', WA: 'America/Los_Angeles',
  // Other
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
}

export const DEFAULT_TIMEZONE = 'America/Chicago'

export function timeZoneForState(state?: string | null): string {
  if (!state) return DEFAULT_TIMEZONE
  return STATE_TZ[state.trim().toUpperCase()] || DEFAULT_TIMEZONE
}
