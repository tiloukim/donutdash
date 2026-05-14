-- Per-shop snapshots of menu state, keyed by template_id, so switching
-- between templates preserves prior work and can be restored later.

alter table dd_shops add column if not exists current_template_id text;

create table if not exists dd_menu_snapshots (
  shop_id uuid not null references dd_shops(id) on delete cascade,
  template_id text not null,
  items_json jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (shop_id, template_id)
);

create index if not exists idx_dd_menu_snapshots_shop on dd_menu_snapshots(shop_id);
