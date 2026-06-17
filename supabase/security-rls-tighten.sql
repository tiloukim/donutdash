-- Tighten RLS on tables flagged by the "RLS Policy Always True"
-- advisor. Every flagged table is currently accessed only through
-- service-role API routes (verified by grep against app/api/* and
-- components/*). The service role bypasses RLS, so dropping the
-- permissive policies breaks nothing while closing the hole.
--
-- Keep RLS enabled on each table — that locks anon and authenticated
-- roles out completely. Any future direct client access will fail
-- loudly and force us to add a properly-scoped policy, rather than
-- silently inheriting USING(true).

-- ============================================================
-- dd_contact_submissions
-- ============================================================
-- Old: "Public insert" with WITH CHECK (true) let any anon role
-- insert directly via PostgREST. The only insert path today is
-- /api/support/contact (service role) which validates and rate-limits
-- before writing.
drop policy if exists "Public insert contact_submissions" on dd_contact_submissions;
drop policy if exists "Service role full access contact_submissions" on dd_contact_submissions;

-- ============================================================
-- dd_forum_posts / dd_forum_replies
-- ============================================================
-- Old policies let any authenticated user insert posts/replies with
-- ARBITRARY author_id (with check true). All forum access today goes
-- through /api/shop/forum/* which validates auth and forces
-- author_id = ddUser.id server-side.
drop policy if exists "forum_posts_read" on dd_forum_posts;
drop policy if exists "forum_posts_insert" on dd_forum_posts;
drop policy if exists "forum_posts_update" on dd_forum_posts;
drop policy if exists "forum_posts_delete" on dd_forum_posts;

drop policy if exists "forum_replies_read" on dd_forum_replies;
drop policy if exists "forum_replies_insert" on dd_forum_replies;
drop policy if exists "forum_replies_update" on dd_forum_replies;
drop policy if exists "forum_replies_delete" on dd_forum_replies;

-- dd_forum_categories is read-only seed data; keep the existing
-- authenticated-read policy so categories can still be listed even if
-- something direct shows up later. (It's not in the linter screenshot.)

-- ============================================================
-- dd_push_subscriptions
-- ============================================================
-- Old: FOR ALL USING (true) exposed every user's endpoint + VAPID
-- keys to any authenticated client. Subscriptions are written and
-- read only by /api/push/* (service role).
drop policy if exists "Service role full access push_subs" on dd_push_subscriptions;

-- ============================================================
-- dd_suppliers and the rest of the supply-ordering family
-- ============================================================
-- Old: FOR ALL USING (true) WITH CHECK (true) gave authenticated
-- clients full write access. All access goes through service-role
-- API routes today. We drop these and let RLS lock the tables to
-- service-role-only. Including the sibling tables (categories,
-- products, orders, order_items) so the family is consistent — they
-- have the same dead policy and were just outside the screenshot.
drop policy if exists "Service role full access" on dd_suppliers;
drop policy if exists "Service role full access" on dd_supply_categories;
drop policy if exists "Service role full access" on dd_supply_products;
drop policy if exists "Service role full access" on dd_supply_orders;
drop policy if exists "Service role full access" on dd_supply_order_items;

-- ============================================================
-- Sanity: confirm RLS is still ENABLED on each table. Disabled RLS
-- triggers a different advisor warning ("RLS Disabled in Public
-- Schema") and would let anon/authenticated read everything.
-- ============================================================
alter table dd_contact_submissions enable row level security;
alter table dd_forum_posts          enable row level security;
alter table dd_forum_replies        enable row level security;
alter table dd_push_subscriptions   enable row level security;
alter table dd_suppliers            enable row level security;
alter table dd_supply_categories    enable row level security;
alter table dd_supply_products      enable row level security;
alter table dd_supply_orders        enable row level security;
alter table dd_supply_order_items   enable row level security;
