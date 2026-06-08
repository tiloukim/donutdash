-- Cash discount program. Listed menu prices are the CARD price; cash
-- customers get a percentage discount applied at checkout. Legal in
-- all 50 states (cash discount, not surcharge — Visa/MC compliant
-- under Durbin) provided the receipt shows the original price was
-- card-pricing-inclusive. Footer line on the receipt handles that.

-- Per-shop percentage. 0 (default) means the feature is off — the
-- POS skips the dual-charges popup entirely and behaves exactly like
-- today. Set to e.g. 3.00 to offer a 3% cash discount.
alter table dd_shops
  add column if not exists cash_discount_pct numeric(5, 2) not null default 0
    check (cash_discount_pct >= 0 and cash_discount_pct <= 25);

-- Per-sale discount amount in dollars. Recorded on every cash sale
-- so reports can answer "how much have we given back through the
-- cash-discount program this month?" Stays 0 on card sales.
alter table dd_orders
  add column if not exists cash_discount_amount numeric(10, 2) not null default 0;
