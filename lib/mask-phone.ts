/**
 * Redact a phone number down to its last four digits for display.
 *
 * Drivers see who they're delivering to and can confirm the last four against
 * what the customer reads back, without the platform handing out a number
 * that outlives the delivery. Messaging goes through /api/driver/contact,
 * which looks the real number up server-side.
 *
 * Digits are extracted before slicing: the stored value may be E.164
 * (+19035551234) or local ("(903) 555-1234"), and slicing the raw string
 * would return ")" or "4" depending on the format.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***-***-****'
  return `***-***-${digits.slice(-4)}`
}
