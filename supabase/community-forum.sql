-- Community Forum tables for DonutDash shop owners

-- Categories
create table if not exists dd_forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '',
  description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Posts
create table if not exists dd_forum_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references dd_forum_categories(id),
  author_id uuid not null references dd_users(id),
  title text not null,
  body text not null,
  type text not null default 'discussion' check (type in ('discussion','job','equipment','rental','announcement')),
  location text,
  price numeric(10,2),
  is_pinned boolean not null default false,
  is_closed boolean not null default false,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Replies
create table if not exists dd_forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references dd_forum_posts(id) on delete cascade,
  author_id uuid not null references dd_users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_forum_posts_category on dd_forum_posts(category_id);
create index if not exists idx_forum_posts_author on dd_forum_posts(author_id);
create index if not exists idx_forum_replies_post on dd_forum_replies(post_id);

-- RLS
alter table dd_forum_categories enable row level security;
alter table dd_forum_posts enable row level security;
alter table dd_forum_replies enable row level security;

-- Categories: authenticated can read
create policy "forum_categories_read" on dd_forum_categories for select to authenticated using (true);

-- Posts: authenticated can read all, insert own, update/delete own
create policy "forum_posts_read" on dd_forum_posts for select to authenticated using (true);
create policy "forum_posts_insert" on dd_forum_posts for insert to authenticated with check (true);
create policy "forum_posts_update" on dd_forum_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "forum_posts_delete" on dd_forum_posts for delete to authenticated using (author_id = auth.uid());

-- Replies: authenticated can read all, insert own, update/delete own
create policy "forum_replies_read" on dd_forum_replies for select to authenticated using (true);
create policy "forum_replies_insert" on dd_forum_replies for insert to authenticated with check (true);
create policy "forum_replies_update" on dd_forum_replies for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "forum_replies_delete" on dd_forum_replies for delete to authenticated using (author_id = auth.uid());

-- Seed categories
insert into dd_forum_categories (name, icon, description, sort_order) values
  ('General Discussion', '💬', 'Chat with fellow donut shop owners', 1),
  ('Hiring - Bakers', '👨‍🍳', 'Find experienced bakers for your shop', 2),
  ('Hiring - Cashiers & Staff', '🧑‍💼', 'Cashiers, managers, and front-of-house staff', 3),
  ('Equipment For Sale', '🔧', 'Buy and sell bakery equipment', 4),
  ('Shop Space / Rentals', '🏪', 'Shop spaces available or wanted', 5),
  ('Recipes & Tips', '📖', 'Share recipes, techniques, and business tips', 6),
  ('Announcements', '📢', 'DonutDash platform updates and news', 7);
