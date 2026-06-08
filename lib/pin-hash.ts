// Owner PIN hashing — used by the POS Settings PIN gate. Keyspace is
// tiny (10k for 4-digit), so we lean hard on PBKDF2 iterations to make
// brute-force expensive at the algorithm layer. Backend ALSO rate
// limits at the row level (failed_attempts column on dd_shops), giving
// two independent defenses.
//
// Why PBKDF2 over bcrypt/argon2:
//   - Built into Node — no dep churn on Vercel cold starts
//   - Battle-tested for this exact use case (PIN/password derivation)
//   - 200k iterations on Vercel's serverless takes ~50ms, which is
//     fine for a once-per-session verify but expensive to brute force

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'

const ITERATIONS = 200_000
const KEYLEN = 64
const DIGEST = 'sha512'

export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(pin, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  return { hash, salt }
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const computed = pbkdf2Sync(pin, salt, ITERATIONS, KEYLEN, DIGEST)
  const expected = Buffer.from(expectedHash, 'hex')
  if (computed.length !== expected.length) return false
  // Constant-time compare so timing attacks can't enumerate the PIN
  // one digit at a time.
  return timingSafeEqual(computed, expected)
}
