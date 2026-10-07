// Parsing helpers for the iPOSpays FEED payload.
//
// The feed's field names are not published, so nothing here assumes a
// shape: values are found by searching the payload for any of several
// plausible names, at any depth. Kept out of the route so they can be
// exercised directly against real payloads once the first ones arrive.

export type Json = Record<string, unknown>

/** Any run of 12 or more digits is treated as a card number. Amounts,
 *  auth codes, batch numbers and timestamps are shorter and survive,
 *  which is what makes a stored payload worth keeping.
 *
 *  This masks reference numbers too — a 12-digit RRN looks exactly like a
 *  short PAN and nothing in the payload reliably says which is which. The
 *  reference is extracted into its own column before masking, so the value
 *  is kept; only the copy inside raw_payload is masked. Read ref_number,
 *  not the raw payload, when reconciling by reference. */
export function maskPans(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\d{12,}/g, (m) => '#'.repeat(m.length))
  if (Array.isArray(value)) return value.map(maskPans)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, maskPans(v)]))
  }
  return value
}

/** Depth-first search for the first scalar whose key matches, ignoring
 *  case, underscores, spaces and hyphens — feeds disagree about casing
 *  far more often than they disagree about names. */
export function pick(payload: unknown, names: string[]): unknown {
  const wanted = new Set(names.map((n) => n.toLowerCase().replace(/[_\s-]/g, '')))
  let found: unknown
  const walk = (node: unknown) => {
    if (found !== undefined || !node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node as Json)) {
      if (found !== undefined) return
      if (value !== null && value !== undefined && typeof value !== 'object') {
        if (wanted.has(key.toLowerCase().replace(/[_\s-]/g, ''))) {
          found = value
          return
        }
      }
    }
    // Scalars at this level win over anything nested, so the sweep for
    // children happens only once the level itself has been ruled out.
    for (const value of Object.values(node as Json)) {
      if (found !== undefined) return
      walk(value)
    }
  }
  walk(payload)
  return found
}

export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

/** Amounts arrive as dollars ("3.36"), as cents (336), or dollars with a
 *  currency symbol. A decimal point means dollars. A bare integer is
 *  ambiguous and is read as cents, because gateways that send integers
 *  send minor units — reading 336 as $336.00 would be a far louder
 *  error than reading it as $3.36. */
export function amountToCents(value: unknown): number | null {
  const s = text(value)
  if (s === null) return null
  const cleaned = s.replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return cleaned.includes('.') ? Math.round(n * 100) : Math.round(n)
}
