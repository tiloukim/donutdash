-- Follow-up to security-rls-tighten.sql — dd_support_messages was
-- missed in the first pass (didn't appear in the original advisor
-- screenshot). Same shape as the others: all access via service-role
-- routes (/api/shop/support, /api/admin/support), so the
-- FOR ALL USING(true) policy was dead and leaked every support
-- conversation to any authenticated client.
drop policy if exists "Service role full access support" on dd_support_messages;

alter table dd_support_messages enable row level security;
