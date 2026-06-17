-- ============================================================
-- Per-shop menu categories
--
-- Run in Supabase SQL editor.
--
-- Drops the fixed 5-category CHECK constraint on dd_menu_items.category
-- so each shop can manage its own list. Existing rows keep their lower-
-- case category strings ('donuts', 'coffee', etc.) and existing shops
-- are seeded with those 5 defaults so nothing breaks. Shop owners can
-- rename, reorder, add, or remove (delete blocked when in use) from
-- the POS Manage Menu screen.
-- ============================================================

create table if not exists dd_menu_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_dd_menu_categories_shop on dd_menu_categories(shop_id);
-- Case-insensitive uniqueness per shop so "Donuts" and "donuts" can't
-- both exist for the same shop.
create unique index if not exists ux_dd_menu_categories_shop_name
  on dd_menu_categories(shop_id, lower(name));

-- Remove the legacy CHECK so dd_menu_items.category can be any string
-- (matched by name against dd_menu_categories).
alter table dd_menu_items drop constraint if exists dd_menu_items_category_check;

-- Seed every existing shop with the historical defaults so the migration
-- is non-breaking. ON CONFLICT prevents re-seeding on rerun.
insert into dd_menu_categories (shop_id, name, sort_order)
select s.id, x.name, x.sort_order
from dd_shops s
cross join lateral (values
  ('donuts', 1),
  ('coffee', 2),
  ('breakfast', 3),
  ('drinks', 4),
  ('other', 5)
) as x(name, sort_order)
on conflict (shop_id, lower(name)) do nothing;

-- RLS — shop owners + admins manage their own categories.
alter table dd_menu_categories enable row level security;

drop policy if exists "Shop owners can manage own categories" on dd_menu_categories;
create policy "Shop owners can manage own categories"
  on dd_menu_categories for all
  using (
    shop_id in (
      select id from dd_shops where owner_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

drop policy if exists "Anyone can read active shop categories" on dd_menu_categories;
create policy "Anyone can read active shop categories"
  on dd_menu_categories for select
  using (true);
