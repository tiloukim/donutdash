-- Make the per-card-transaction fee configurable per shop.
--
-- Previously a hardcoded $0.15 (lib/constants POS_CARD_TRANSACTION_FEE).
-- Now each shop carries its own rate (defaults to 0.15) so it can be raised
-- later. /api/pos/orders reads it when logging dd_pos_card_fees; the ledger
-- keeps the amount actually charged, so historical bills stay accurate even
-- if the rate changes.

alter table dd_shops add column if not exists pos_card_fee numeric not null default 0.15;
