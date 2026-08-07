-- POS card-transaction fee ledger.
--
-- DonutDash bills the SHOP OWNER a flat fee (default $0.15) for every
-- in-store card transaction. This is NOT charged to the customer and is
-- kept OUT of the order total — it's a shop-owner cost, so it lives in its
-- own table. One row per card sale; the shop's report sums it.
--
-- Written only via /api/pos/orders (service client); RLS on with no
-- policies locks it to the service role.

create table if not exists dd_pos_card_fees (
  id              uuid        primary key default gen_random_uuid(),
  shop_id         uuid        not null references dd_shops(id) on delete cascade,
  order_id        uuid        references dd_orders(id) on delete set null,
  amount          numeric     not null default 0.15,
  payment_method  text,
  created_at      timestamptz not null default now()
);

-- Sum a shop's fees over a date range, most-recent first.
create index if not exists dd_pos_card_fees_shop_created_idx
  on dd_pos_card_fees (shop_id, created_at desc);

alter table dd_pos_card_fees enable row level security;
