-- Anonymous call bridging between the parties on an order.
--
-- Nobody is ever handed anybody else's number. A caller asks to reach a role
-- ("the shop", "my driver"); the server resolves both numbers, rings the
-- caller, and when they answer bridges them outward to the other party. Both
-- legs originate from the DonutDash number, so that is the only number either
-- handset ever sees — and it stops working when the order does.
--
-- One row per attempt. It is the authorization record: the TeXML webhook is
-- unauthenticated (Telnyx calls it), so the token in the URL is the only
-- thing standing between a guessed request and a free bridge to a customer.
create table if not exists dd_call_sessions (
  id uuid primary key default gen_random_uuid(),

  -- Unguessable, single-use, and short-lived. Carried in the TeXML URL.
  token text not null unique,

  order_id uuid not null references dd_orders(id) on delete cascade,
  delivery_id uuid references dd_deliveries(id) on delete set null,

  -- Who pressed the button, and who they asked for. Roles, not numbers:
  -- the numbers are resolved server-side at bridge time so a stale row can
  -- never dial somewhere the order no longer points.
  caller_user_id uuid references dd_users(id) on delete set null,
  caller_role text not null check (caller_role in ('customer','driver','shop','admin')),
  callee_role text not null check (callee_role in ('customer','driver','shop','admin')),

  -- Snapshotted for the call log and for support. Not returned to any client.
  caller_phone text,
  callee_phone text,

  status text not null default 'pending'
    check (status in ('pending','ringing','bridged','no_answer','failed','expired')),

  telnyx_call_sid text,
  failure_reason text,

  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  -- Short by design: a token that outlives the tap is a standing invitation.
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

create index if not exists dd_call_sessions_token_idx on dd_call_sessions (token);
create index if not exists dd_call_sessions_order_idx on dd_call_sessions (order_id, created_at desc);
create index if not exists dd_call_sessions_caller_idx on dd_call_sessions (caller_user_id, created_at desc);

-- Service-role only. Every read and write goes through /api/calls/*, which
-- does its own relationship check against the order; no client should ever
-- select from this table directly, and the phone columns are why.
alter table dd_call_sessions enable row level security;
