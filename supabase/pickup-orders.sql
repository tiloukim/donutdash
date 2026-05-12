-- Pickup orders support.
--
-- Adds a fulfillment_type discriminator and relaxes the NOT NULL
-- constraint on delivery_* columns so pickup orders can be created
-- without a delivery address. Existing rows are backfilled to
-- 'delivery' so nothing breaks for in-flight orders.

alter table dd_orders
  add column if not exists fulfillment_type text not null default 'delivery'
    check (fulfillment_type in ('delivery', 'pickup'));

alter table dd_orders alter column delivery_address drop not null;
alter table dd_orders alter column delivery_city drop not null;

create index if not exists idx_dd_orders_fulfillment_type on dd_orders(fulfillment_type);
