-- Human-friendly sequential shop ID for admin search (#1001, #1002, ...).
-- Disambiguates shops that share a name across locations, cities, or owners.
-- The UUID dd_shops.id stays the primary key; this is a short display/search code.
--
-- Safe to run once. Idempotent guards let a re-run be a no-op.

-- 1. Sequence for the shop numbers, starting at 1001.
create sequence if not exists dd_shops_number_seq start with 1001;

-- 2. Add the column (nullable first so we can backfill deterministically).
alter table dd_shops add column if not exists shop_number integer;

-- 3. Backfill existing shops in creation order so numbering is stable/meaningful.
do $$
declare r record;
begin
  for r in
    select id from dd_shops where shop_number is null
    order by created_at asc nulls last, id asc
  loop
    update dd_shops set shop_number = nextval('dd_shops_number_seq') where id = r.id;
  end loop;
end $$;

-- 4. New shops auto-assign the next number; enforce presence + uniqueness.
alter table dd_shops alter column shop_number set default nextval('dd_shops_number_seq');
alter table dd_shops alter column shop_number set not null;
create unique index if not exists dd_shops_shop_number_key on dd_shops (shop_number);

-- 5. Tie the sequence lifecycle to the column.
alter sequence dd_shops_number_seq owned by dd_shops.shop_number;
