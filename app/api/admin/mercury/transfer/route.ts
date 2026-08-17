import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { mercuryInternalTransfer, mercuryConfigured } from '@/lib/mercury'

export const dynamic = 'force-dynamic'

// POST — move sales tax from the operating account to the tax account via a
// Mercury INTERNAL transfer (own accounts only — cannot send money externally).
// Admin-only, explicit amount, logged to dd_tax_transfers.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!mercuryConfigured()) return NextResponse.json({ error: 'Mercury is not connected.' }, { status: 400 })

  const { sourceAccountId, destinationAccountId, amount, note } = await req.json().catch(() => ({}))
  const amt = Number(amount)
  if (!sourceAccountId || !destinationAccountId) return NextResponse.json({ error: 'Pick a source and tax account.' }, { status: 400 })
  if (sourceAccountId === destinationAccountId) return NextResponse.json({ error: 'Source and destination must differ.' }, { status: 400 })
  if (!Number.isFinite(amt) || amt < 0.01) return NextResponse.json({ error: 'Enter an amount of at least $0.01.' }, { status: 400 })
  if (amt > 100000) return NextResponse.json({ error: 'Amount over $100,000 — do large transfers in Mercury directly.' }, { status: 400 })

  // Idempotency: same amount + accounts within the same minute won't double-move.
  const idempotencyKey = `dd-tax-${sourceAccountId}-${destinationAccountId}-${amt.toFixed(2)}-${new Date().toISOString().slice(0, 16)}`

  try {
    const result = await mercuryInternalTransfer({
      sourceAccountId, destinationAccountId, amount: amt,
      note: note || 'DonutDash sales tax set-aside',
      idempotencyKey,
    })
    await svc.from('dd_tax_transfers').insert({
      amount: amt,
      note: note || 'DonutDash sales tax set-aside',
      source_account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      mercury_debit_txn_id: result.debitId,
      mercury_credit_txn_id: result.creditId,
      created_by: ddUser.id,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Transfer failed' }, { status: 502 })
  }
}
