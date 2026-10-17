-- A sold-out substitution the customer still has a chance to refuse.
--
-- The shop proposes a replacement, texts the customer, and carries on. If no
-- reply arrives within the window, silence is the yes and nothing further
-- happens — which is why there is no cron here and no held order. The row
-- exists only so a REJECTION arriving in time knows what to undo and how
-- much to give back.
--
-- Deliberately not a column on dd_orders: an order can have several lines
-- substituted at once, each with its own amount, and each refusable on its
-- own.

create table if not exists public.dd_substitution_offers (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.dd_orders(id) on delete cascade,
  -- Null once the line is deleted by a rejection; the names below are what
  -- the message to the customer referred to, so they are kept regardless.
  order_item_id   uuid,
  original_name   text not null,
  replacement_name text not null,
  -- What the customer gets back if they refuse: the line and its share of
  -- tax and fees, computed when the offer was made rather than re-derived
  -- later against an order that has since changed.
  refund_amount   numeric(10,2) not null check (refund_amount >= 0),
  customer_phone  text,
  expires_at      timestamptz not null,
  resolved_at     timestamptz,
  -- accepted_silently | rejected | expired
  outcome         text check (outcome in ('accepted_silently', 'rejected', 'expired')),
  created_at      timestamptz not null default now()
);

-- The inbound SMS path looks up by phone and open window on every reply, so
-- this is the index that matters.
create index if not exists dd_substitution_offers_open_idx
  on public.dd_substitution_offers (customer_phone, expires_at)
  where resolved_at is null;

create index if not exists dd_substitution_offers_order_idx
  on public.dd_substitution_offers (order_id);

alter table public.dd_substitution_offers enable row level security;

-- No policies on purpose: this is written and read by the service role only
-- (the accept endpoint and the SMS webhook). A customer never queries it;
-- they answer a text message.
