-- Welcome-offer abuse fix for guest checkout.
--
-- The welcome (first-order) discount is granted to a "new customer" = a
-- customer_id with no prior non-cancelled orders. Guest checkout mints a fresh
-- anonymous user (new customer_id) every time, so a returning guest would
-- re-qualify for the discount on every order. This function lets the promo
-- logic also disqualify anyone whose PHONE has already placed an order —
-- matching on the last 10 digits so "(903) 555-1234", "9035551234", and
-- "+19035551234" all count as the same person.
create or replace function has_prior_order_by_phone(p text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from dd_orders
    where status <> 'cancelled'
      and length(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g')) >= 10
      and right(regexp_replace(customer_phone, '\D', '', 'g'), 10)
        = right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
  );
$$;

-- Only the server (service role) computes eligibility. Don't expose this to
-- anon/authenticated clients (it would let anyone probe whether a phone has
-- ordered).
revoke all on function has_prior_order_by_phone(text) from public;
revoke all on function has_prior_order_by_phone(text) from anon;
revoke all on function has_prior_order_by_phone(text) from authenticated;
grant execute on function has_prior_order_by_phone(text) to service_role;

-- Address gate (second layer). EXACT normalized match of the full delivery
-- address + city, so re-ordering to your own address is caught, but a genuinely
-- new customer in the same building (different unit) is NOT wrongly denied their
-- welcome offer. Normalization strips case + all non-alphanumerics.
create or replace function has_prior_order_by_address(addr text, city text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from dd_orders
    where status <> 'cancelled'
      and regexp_replace(lower(coalesce(delivery_address, '')), '[^a-z0-9]', '', 'g') <> ''
      and regexp_replace(lower(coalesce(delivery_address, '')), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(coalesce(addr, '')), '[^a-z0-9]', '', 'g')
      and regexp_replace(lower(coalesce(delivery_city, '')), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(coalesce(city, '')), '[^a-z0-9]', '', 'g')
  );
$$;

revoke all on function has_prior_order_by_address(text, text) from public;
revoke all on function has_prior_order_by_address(text, text) from anon;
revoke all on function has_prior_order_by_address(text, text) from authenticated;
grant execute on function has_prior_order_by_address(text, text) to service_role;

-- Card fingerprint (Square's stable per-card id) captured on each order. Used
-- for post-hoc abuse DETECTION (a repeat card claiming the welcome offer is
-- logged), not a hard pre-charge block — blocking pre-charge would require
-- saving the card before charging, which breaks Apple Pay / Google Pay.
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS card_fingerprint text;
