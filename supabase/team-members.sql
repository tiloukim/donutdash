-- Team / staff business cards
--
-- Replaces the hardcoded array in lib/team.ts so admin can manage cards
-- through /admin/team without a code commit + redeploy.
--
-- Run in Supabase SQL editor.

create table if not exists public.dd_team_members (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text not null,
  phone text not null,
  email text not null,
  location text not null default 'Tyler, Texas',
  photo_url text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.dd_team_members is
  'Staff/team digital business cards. Public card pages live at /card/[slug].';

-- Seed the existing two members so their existing URLs (donutdash.app/card/Tilou,
-- /card/saray) keep working through the cutover. ON CONFLICT prevents
-- re-seeding if the migration is run twice.
insert into public.dd_team_members (slug, name, title, phone, email, location, display_order)
values
  ('Tilou', 'Tilou Kim', 'Founder', '9033455599', 'Donutdash903@gmail.com', 'Tyler, Texas', 0),
  ('saray', 'Saray Tem', 'Operations Manager', '6264919094', 'Saraytem@donutdash.app', 'Tyler, Texas', 1)
on conflict (slug) do nothing;
