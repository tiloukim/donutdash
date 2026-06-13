-- dd_rate_limits backs lib/rate-limit.checkRateLimit() so quotas are
-- shared across Vercel serverless instances (the old in-memory Map
-- was per-process — effectively no rate limit in prod).
--
-- One row per (key) — caller composes the key (e.g. "login:ip:1.2.3.4",
-- "verify:phone:+15551234567"). Stale rows are reset on next call;
-- a lightweight cleanup job can sweep periodically if the table grows.

create table if not exists dd_rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_dd_rate_limits_reset_at on dd_rate_limits (reset_at);

alter table dd_rate_limits disable row level security;

-- Atomic check-and-increment in a single transaction.
-- Returns json: { allowed: boolean, remaining: int, reset_at: timestamptz }.
-- Window is fixed-bucket per-key: reset_at is set when the bucket starts,
-- count increments until reset_at passes, then a new bucket starts.
create or replace function check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
) returns json
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => p_window_seconds);
  v_row dd_rate_limits;
begin
  insert into dd_rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + v_window)
  on conflict (key) do update set
    count = case
      when dd_rate_limits.reset_at < v_now then 1
      else dd_rate_limits.count + 1
    end,
    reset_at = case
      when dd_rate_limits.reset_at < v_now then v_now + v_window
      else dd_rate_limits.reset_at
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
