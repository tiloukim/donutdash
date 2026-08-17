// Mercury banking API — INTERNAL transfers only (between the org's own accounts).
// Uses MERCURY_API_TOKEN from env. The /transfer endpoint can only move funds
// between your own Mercury accounts; it cannot send money to an external
// recipient — so this integration can never move money OUT of the business,
// only between (e.g.) the operating account and the tax account.
const BASE = 'https://api.mercury.com/api/v1'

export function mercuryConfigured(): boolean {
  return !!process.env.MERCURY_API_TOKEN
}

async function mercury(path: string, init?: RequestInit) {
  const token = process.env.MERCURY_API_TOKEN
  if (!token) throw new Error('Mercury is not connected. Add MERCURY_API_TOKEN in settings.')
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!res.ok) {
    const b = body as { errors?: Array<{ message?: string }>; message?: string } | null
    throw new Error(b?.errors?.[0]?.message || b?.message || `Mercury API error (${res.status})`)
  }
  return body
}

export interface MercuryAccount { id: string; name: string; availableBalance: number; kind: string | null }

export async function listMercuryAccounts(): Promise<MercuryAccount[]> {
  const data = await mercury('/accounts') as { accounts?: Array<Record<string, unknown>> }
  return (data?.accounts || []).map((a) => ({
    id: String(a.id),
    name: String(a.nickname ?? a.name ?? 'Account'),
    availableBalance: Number(a.availableBalance ?? a.currentBalance ?? 0),
    kind: (a.kind as string) ?? null,
  }))
}

export async function mercuryInternalTransfer(args: {
  sourceAccountId: string
  destinationAccountId: string
  amount: number
  note?: string
  idempotencyKey: string
}): Promise<{ debitId: string | null; creditId: string | null }> {
  const data = await mercury('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      sourceAccountId: args.sourceAccountId,
      destinationAccountId: args.destinationAccountId,
      amount: Math.round(args.amount * 100) / 100,
      idempotencyKey: args.idempotencyKey,
      ...(args.note ? { note: args.note } : {}),
    }),
  }) as { debitTransaction?: { id?: string }; creditTransaction?: { id?: string } }
  return { debitId: data?.debitTransaction?.id ?? null, creditId: data?.creditTransaction?.id ?? null }
}
