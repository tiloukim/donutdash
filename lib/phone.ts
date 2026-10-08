// Phone normalisation — the single rule for deciding whether two numbers are
// the same person.
//
// The database owns the authoritative version (dd_users.phone_normalized is a
// stored generated column with the same logic), so a client that forgets to
// call this cannot create a duplicate. This exists so the server can LOOK UP
// by the same key the index is built on, and so the POS can format a number
// for display without inventing its own rule.
//
// NANP only, which is all this platform serves. Anything else returns null and
// simply does not participate in matching — a number we cannot parse must not
// match a different number we also cannot parse.

/** Digits only, 10 characters, or null. Mirrors the generated column. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

/** (903) 555-1212 — for a receipt or a confirmation the cashier reads aloud. */
export function formatPhone(input: string | null | undefined): string {
  const n = normalizePhone(input)
  if (!n) return input ?? ''
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
}

/**
 * (903) ***-1212 — what goes on a customer-facing screen, a log line, or any
 * report a third party might read.
 *
 * The area code and last four are enough for a customer to recognise their
 * own number and for a cashier to confirm they picked the right person; the
 * middle three are what makes it dialable, and nothing in this system needs
 * that on screen.
 */
export function maskPhone(input: string | null | undefined): string {
  const n = normalizePhone(input)
  if (!n) return ''
  return `(${n.slice(0, 3)}) ***-${n.slice(6)}`
}
