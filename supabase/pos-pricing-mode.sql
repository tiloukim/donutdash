-- Per-shop pricing display mode. Drives whether (and how) the
-- cash-discount program surfaces to the customer.
--
--   'standard'      — single listed price; no popup, no dual display.
--                     The pre-program behavior. Also the safe value when
--                     cash_discount_pct is 0.
--
--   'cash_discount' — single listed price (the CARD price); popup at
--                     checkout shows the cash savings. What we shipped
--                     in the previous build.
--
--   'dual_pricing'  — BOTH prices shown on every menu item upfront —
--                     menu tiles, cart lines, customer-facing web. Same
--                     legal program as cash_discount; just more visible.
--                     Customer "feels" the cash savings before reaching
--                     the register, which typically lifts cash share
--                     more than checkout-only disclosure.
--
-- Mode is independent of cash_discount_pct. A shop with mode='dual_pricing'
-- but pct=0 simply shows the same price twice — the POS treats that as
-- standard at runtime. Setting mode without pct (or vice versa) is
-- always safe.

alter table dd_shops
  add column if not exists pricing_mode text not null default 'standard'
    check (pricing_mode in ('standard', 'cash_discount', 'dual_pricing'));
