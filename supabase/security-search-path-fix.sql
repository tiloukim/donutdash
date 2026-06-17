-- Pin search_path on flagged functions to close the "Function Search
-- Path Mutable" advisor warning. Without an explicit search_path, an
-- attacker who can create objects in any schema reachable by the caller
-- (notably pg_temp) can shadow built-in/public objects and hijack the
-- function. Empty search_path + fully qualified references is the
-- defense-in-depth pattern Supabase recommends — pg_catalog is always
-- searched implicitly so built-ins still resolve.

-- 1. dd_generate_short_code — uses gen_random_uuid from pgcrypto
--    (extensions schema on Supabase) plus built-in string fns.
create or replace function public.dd_generate_short_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  code text;
begin
  code := upper(substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 5));
  return code;
end;
$$;

-- 2. dd_orders_set_short_code — trigger that calls the generator above.
create or replace function public.dd_orders_set_short_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.short_code is null then
    new.short_code := public.dd_generate_short_code();
  end if;
  return new;
end;
$$;

-- 3. dd_pitch_recipients_touch_updated_at — touch trigger.
create or replace function public.dd_pitch_recipients_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4. dd_shop_terminal_creds_touch_updated_at — touch trigger.
create or replace function public.dd_shop_terminal_creds_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5. dd_shop_staff_touch_updated_at — touch trigger.
create or replace function public.dd_shop_staff_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6. check_rate_limit — atomic check-and-increment used by every API
--    route that gates by IP/phone/etc. Empty search_path means
--    dd_rate_limits must be qualified as public.dd_rate_limits.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
) returns json
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => p_window_seconds);
  v_row public.dd_rate_limits;
begin
  insert into public.dd_rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + v_window)
  on conflict (key) do update set
    count = case
      when public.dd_rate_limits.reset_at < v_now then 1
      else public.dd_rate_limits.count + 1
    end,
    reset_at = case
      when public.dd_rate_limits.reset_at < v_now then v_now + v_window
      else public.dd_rate_limits.reset_at
    end,
    updated_at = v_now
  returning * into v_row;

  return json_build_object(
    'allowed', v_row.count <= p_limit,
    'remaining', greatest(0, p_limit - v_row.count),
    'reset_at', v_row.reset_at
  );
end;
$$;
