-- Recurring outreach list for the unclaimed-shop pitch campaign.
--
-- Admins curate this list — each row pairs a target shop with a real
-- shop-owner email/phone we've gathered (from public Google Business
-- profiles, our previous DonutDash outreach, walk-in chats, etc.).
-- The weekly cron at /api/cron/pitch-weekly sends a fresh pitch email
-- to active recipients whose last_sent_at is more than 7 days old.
--
-- Compliance: every email includes an unsubscribe link tied to
-- unsubscribe_token; hitting that link sets unsubscribed_at and the
-- cron skips the recipient permanently. SMS is intentionally NOT
-- auto-blasted (TCPA opt-in nuance) — admins send SMS one-by-one
-- through the admin pitch page after a separate consent step.

create table if not exists dd_pitch_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,

  -- Owner contact. Email is required (that's what we auto-send to).
  -- Phone is optional, surfaced in the admin UI for manual SMS only.
  recipient_email text not null,
  recipient_name text,
  recipient_phone text,
  notes text,

  -- Lifecycle:
  --   'active'   eligible for the weekly cron
  --   'paused'   admin-disabled, skip but keep for reference
  --   'replied'  admin marks after a real response — no more sends
  status text not null default 'active' check (status in ('active', 'paused', 'replied')),

  -- Last successful cron-driven send. Cron skips if < 7 days ago.
  last_sent_at timestamptz,
  send_count integer default 0,

  -- CAN-SPAM unsubscribe. Stamped when the recipient hits
  -- /unsubscribe/<token>; the cron treats this as a hard stop.
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,

  created_at timestamptz default now(),
  created_by uuid references dd_users(id) on delete set null,
  updated_at timestamptz default now()
);

create index if not exists dd_pitch_recipients_shop_idx
  on dd_pitch_campaign_recipients(shop_id);
create index if not exists dd_pitch_recipients_status_idx
  on dd_pitch_campaign_recipients(status, last_sent_at);
create unique index if not exists dd_pitch_recipients_email_shop_idx
  on dd_pitch_campaign_recipients(shop_id, lower(recipient_email));

alter table dd_pitch_campaign_recipients disable row level security;

-- Touch updated_at on writes.
create or replace function dd_pitch_recipients_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dd_pitch_recipients_updated_at on dd_pitch_campaign_recipients;
create trigger trg_dd_pitch_recipients_updated_at
  before update on dd_pitch_campaign_recipients
  for each row execute function dd_pitch_recipients_touch_updated_at();
