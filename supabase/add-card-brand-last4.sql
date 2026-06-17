-- Add card brand + last 4 to dd_orders so the Transactions screen can
-- show "Mastercard 1427" Square-style instead of a generic "Card" row.
-- Populated by submitPosOrder when the sale is a card_pax transaction.
-- Both nullable since cash sales / older rows don't have them.

alter table dd_orders add column if not exists card_brand text;
alter table dd_orders add column if not exists card_last4 text;

comment on column dd_orders.card_brand is 'Card network reported by the terminal (VISA, MASTERCARD, AMEX, DISCOVER, etc.) at submit. Null for non-card sales.';
comment on column dd_orders.card_last4 is 'Last 4 of the PAN reported by the terminal. Null for non-card sales.';
