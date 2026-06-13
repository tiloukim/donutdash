-- dd_role_permissions: which admin portal roles can see which pages.
-- Existence of a row = allowed; absence = denied. Lets admin edit
-- the access matrix from the UI without shipping code.
--
-- The platform 'admin' role is always granted access to every page
-- at the application layer regardless of what this table says — that's
-- the lockout safety rail.

create table if not exists dd_role_permissions (
  role text not null,
  page_path text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references dd_users(id) on delete set null,
  primary key (role, page_path)
);

-- RLS off; writes go through service-role via /api/admin/role-permissions.
alter table dd_role_permissions disable row level security;

-- Bootstrap from the current static PAGE_ROLES matrix (lib/admin-auth.ts
-- as of 2026-06-13). Idempotent via on conflict do nothing so re-running
-- is safe.
insert into dd_role_permissions (role, page_path) values
  -- /admin (Dashboard)
  ('admin',             '/admin'),
  ('general_manager',   '/admin'),
  ('field_manager',     '/admin'),
  ('marketing_manager', '/admin'),
  -- /admin/shops
  ('admin',             '/admin/shops'),
  ('general_manager',   '/admin/shops'),
  ('field_manager',     '/admin/shops'),
  ('marketing_manager', '/admin/shops'),
  -- /admin/users
  ('admin',             '/admin/users'),
  ('general_manager',   '/admin/users'),
  -- /admin/orders
  ('admin',             '/admin/orders'),
  ('general_manager',   '/admin/orders'),
  ('field_manager',     '/admin/orders'),
  -- /admin/drivers
  ('admin',             '/admin/drivers'),
  ('general_manager',   '/admin/drivers'),
  ('field_manager',     '/admin/drivers'),
  -- /admin/driver-documents
  ('admin',             '/admin/driver-documents'),
  ('general_manager',   '/admin/driver-documents'),
  ('field_manager',     '/admin/driver-documents'),
  -- /admin/shop-documents
  ('admin',             '/admin/shop-documents'),
  ('general_manager',   '/admin/shop-documents'),
  ('field_manager',     '/admin/shop-documents'),
  -- /admin/claim-requests
  ('admin',             '/admin/claim-requests'),
  -- /admin/payouts
  ('admin',             '/admin/payouts'),
  ('general_manager',   '/admin/payouts'),
  -- /admin/catering
  ('admin',             '/admin/catering'),
  ('general_manager',   '/admin/catering'),
  ('field_manager',     '/admin/catering'),
  -- /admin/support
  ('admin',             '/admin/support'),
  ('general_manager',   '/admin/support'),
  ('field_manager',     '/admin/support'),
  -- /admin/voicemails
  ('admin',             '/admin/voicemails'),
  ('general_manager',   '/admin/voicemails'),
  ('field_manager',     '/admin/voicemails'),
  -- /admin/ivr
  ('admin',             '/admin/ivr'),
  ('general_manager',   '/admin/ivr'),
  -- /admin/ivr-extensions
  ('admin',             '/admin/ivr-extensions'),
  ('general_manager',   '/admin/ivr-extensions'),
  -- /admin/disputes
  ('admin',             '/admin/disputes'),
  ('general_manager',   '/admin/disputes'),
  ('field_manager',     '/admin/disputes'),
  -- /admin/flyers
  ('admin',             '/admin/flyers'),
  ('general_manager',   '/admin/flyers'),
  ('marketing_manager', '/admin/flyers'),
  -- /admin/menu-templates
  ('admin',             '/admin/menu-templates'),
  ('general_manager',   '/admin/menu-templates'),
  ('marketing_manager', '/admin/menu-templates'),
  -- /admin/team
  ('admin',             '/admin/team'),
  ('general_manager',   '/admin/team'),
  ('marketing_manager', '/admin/team'),
  -- /admin/analytics
  ('admin',             '/admin/analytics'),
  ('general_manager',   '/admin/analytics'),
  ('field_manager',     '/admin/analytics'),
  ('marketing_manager', '/admin/analytics'),
  -- /admin/pitch-campaign
  ('admin',             '/admin/pitch-campaign'),
  ('general_manager',   '/admin/pitch-campaign'),
  ('field_manager',     '/admin/pitch-campaign'),
  ('marketing_manager', '/admin/pitch-campaign'),
  -- /admin/access-matrix
  ('admin',             '/admin/access-matrix'),
  ('general_manager',   '/admin/access-matrix'),
  ('field_manager',     '/admin/access-matrix'),
  ('marketing_manager', '/admin/access-matrix'),
  -- /admin/tax
  ('admin',             '/admin/tax'),
  -- /admin/settings
  ('admin',             '/admin/settings')
on conflict (role, page_path) do nothing;
