-- Bookkeeping entries for each shop
create table if not exists dd_bookkeeping (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  description text not null,
  amount numeric(10,2) not null,
  category text not null,
  source text, -- e.g. 'manual', 'donutdash', bank name
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_dd_bookkeeping_shop on dd_bookkeeping(shop_id);
create index if not exists idx_dd_bookkeeping_date on dd_bookkeeping(shop_id, date);

-- RLS
alter table dd_bookkeeping enable row level security;

create policy "Shop owners can manage their bookkeeping"
  on dd_bookkeeping for all
  using (shop_id in (select id from dd_shops where owner_id = auth.uid()))
  with check (shop_id in (select id from dd_shops where owner_id = auth.uid()));
