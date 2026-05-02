-- Add small_order_fee column to dd_orders
-- Charged on orders where subtotal < $10 (per spec §2: $1.99 small order fee).
-- Idempotent: safe to re-run.

alter table public.dd_orders
  add column if not exists small_order_fee numeric(10,2) not null default 0;

comment on column public.dd_orders.small_order_fee is
  'Flat fee charged when subtotal is below the platform minimum ($10). $1.99 default per spec §2.';
