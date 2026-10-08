-- Make short_code actually unique, and let the register keep the code it
-- already printed.
--
-- TWO PROBLEMS, one fix.
--
-- 1. An offline sale prints a receipt before it can reach the server, so the
--    queue mints a 5-character code for it. That code was never sent: the
--    payload has no field for it, so on sync the trigger generated a
--    different one. A customer coming back with an offline receipt showing
--    K4M7P could not be found, because the order was recorded under
--    something else entirely.
--
-- 2. short_code was never unique. The column is plain `text` with no index,
--    and dd_generate_short_code() takes five hex characters off a UUID —
--    16^5, about 1.05 million codes. Birthday maths on 829 existing orders
--    puts the chance of a collision already having happened at roughly 28%;
--    there is none yet, which is luck rather than design, and the odds pass
--    85% somewhere near two thousand orders. Two orders sharing a code is
--    silent today: nothing would reject it and a receipt lookup would simply
--    return the wrong sale.
--
-- Fixing 2 is what makes 1 safe to do. Accepting a code from a register is
-- only reasonable when a clash is impossible rather than merely unlikely.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. A bigger alphabet
-- ─────────────────────────────────────────────────────────────────────────
-- 31 characters rather than 16, skipping I, O, 0 and 1 because these get
-- read aloud across a counter and written on paper bags. 31^5 is about 28.6
-- million, which moves a collision from "eventually certain" to "needs a
-- retry loop for form's sake". The retry loop is there anyway.
create or replace function public.dd_generate_short_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
  tries integer := 0;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.dd_orders o where o.short_code = code);
    tries := tries + 1;
    -- 28.6 million codes; this cannot realistically spin, but a generator
    -- that CAN loop forever has no business in an insert path.
    if tries > 20 then
      raise exception 'Could not find a free short_code after % tries', tries;
    end if;
  end loop;
  return code;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Honour a supplied code, unless it is taken
-- ─────────────────────────────────────────────────────────────────────────
-- The register sends the code it already printed on the offline receipt. If
-- it is free it is kept, so the paper and the record agree. If it is somehow
-- taken, a fresh one is generated rather than failing the insert: a sale that
-- has already been handed over must not be rejected over a cosmetic
-- identifier, and a receipt whose code does not match is a far smaller
-- problem than a sale that will not save.
create or replace function public.dd_orders_set_short_code() returns trigger
language plpgsql as $$
begin
  if new.short_code is null
     or exists (select 1 from public.dd_orders o where o.short_code = new.short_code) then
    new.short_code := public.dd_generate_short_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dd_orders_short_code on public.dd_orders;
create trigger trg_dd_orders_short_code
  before insert on public.dd_orders
  for each row execute function public.dd_orders_set_short_code();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The constraint that makes all of the above true
-- ─────────────────────────────────────────────────────────────────────────
-- Refuses to be created if duplicates already exist, which is the point: it
-- is better to find out here than to assume. There are none as of 8 Oct 2026
-- across 829 orders.
do $$
declare v_n integer;
begin
  select count(*) into v_n from (
    select short_code from public.dd_orders
     where short_code is not null
     group by short_code having count(*) > 1
  ) d;
  if v_n > 0 then
    raise exception 'Cannot add the unique index: % short_code values are already duplicated. Resolve them first.', v_n;
  end if;
end $$;

create unique index if not exists dd_orders_short_code_uniq
  on public.dd_orders (short_code)
  where short_code is not null;

commit;
