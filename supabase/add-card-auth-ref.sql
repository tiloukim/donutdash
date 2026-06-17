-- Add the gateway-returned auth code + reference # to dd_orders so
-- reprints from the Transactions tab can show "Authorization: XXXXXX"
-- and "Ref #: XXXXXXXX". Without these, every reprint drops both lines
-- and the cashier can't reconcile a customer's POS receipt against the
-- iPOSpays Transactions log. Both nullable since cash sales and older
-- rows don't have them.

alter table dd_orders add column if not exists card_auth_code text;
alter table dd_orders add column if not exists card_ref_number text;

comment on column dd_orders.card_auth_code is 'Approval / auth code returned by the gateway (Dejavoo AuthCode). Printed as "Authorization:" on POS receipts. Null for non-card sales.';
comment on column dd_orders.card_ref_number is 'Gateway reference number (Dejavoo PNRef / TransNum). Matches the "Ref #" on the iPOSpays terminal receipt for reconciliation. Null for non-card sales.';
