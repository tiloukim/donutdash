-- Shop-page engagement tracking for the unclaimed-shop pitch surface.
--
-- Each row is a single anonymous interaction with a shop's public page.
-- We keep ALL events (claimed + unclaimed shops) but flag was_unclaimed
-- at write time so post-claim aggregations can still count the pre-claim
-- demand (which is the entire pitch — "you had X visitors BEFORE you
-- activated, look what you've been missing").
--
-- Privacy: visitor_hash = SHA-256(ip + utc_date + secret_salt). Gives us
-- unique-visitor-per-day counts without storing IP. Salt rotates daily
-- via the UTC date component, so two different days produce different
-- hashes for the same IP — cross-day fingerprinting isn't possible from
-- this data alone.

create table if not exists dd_shop_engagement (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,

  -- Event taxonomy:
  --   'page_view'        — visitor loaded /shops/[slug]
  --   'lost_order_click' — Add-to-Cart tap on an unclaimed shop's menu item
  --   'claim_link_click' — visitor tapped the "Claim it" link on an unclaimed page
  --   'menu_item_view'   — visitor opened a menu-item modal (intent signal)
  --   (extend as needed)
  kind text not null,

  -- Anonymous per-day visitor identifier (see Privacy note above).
  visitor_hash text,

  -- Context for the pitch — referrer reveals "they came from Google",
  -- path captures the deep link if any.
  path text,
  referrer text,
  user_agent text,

  -- Snapshot of the shop's claimed status AT THE TIME of the event.
  -- Critical for the pitch: a view counted as "lost" pre-activation
  -- shouldn't be re-counted after the shop activates. Without this
  -- flag, our retroactive aggregations would understate historic
  -- demand (because the shop would now show as claimed).
  was_unclaimed boolean default false,

  created_at timestamptz default now()
);

create index if not exists dd_shop_engagement_shop_idx
  on dd_shop_engagement(shop_id, created_at desc);

create index if not exists dd_shop_engagement_kind_idx
  on dd_shop_engagement(kind, created_at desc);

-- Per-day-per-shop unique-visitor count needs this composite index
-- so the pitch page can compute "X unique visitors in 30 days" fast.
create index if not exists dd_shop_engagement_unique_idx
  on dd_shop_engagement(shop_id, visitor_hash, created_at desc);

-- RLS off intentionally — writes come from a public anonymous endpoint
-- via service-role client, reads are admin-only via /api/admin/* routes.
alter table dd_shop_engagement disable row level security;
