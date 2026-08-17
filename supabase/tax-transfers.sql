-- Log of sales-tax transfers moved to the Mercury tax account, so the Tax
-- Center can show how much has been set aside vs. how much is still owed, and
-- never double-move the same money.
create table if not exists dd_tax_transfers (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  source_account_id text,
  destination_account_id text,
  mercury_debit_txn_id text,
  mercury_credit_txn_id text,
  created_by uuid references dd_users(id) on delete set null,
  created_at timestamptz not null default now()
);
