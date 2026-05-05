-- Adds an upload_token to dd_team_members so admin can hand each employee a
-- self-service link like /card/[slug]/upload?t=abc123 to update their photo
-- without an account.
--
-- Run in Supabase SQL editor.

alter table public.dd_team_members
  add column if not exists upload_token text;

-- Backfill a token for any existing rows so the seeded members get one too.
update public.dd_team_members
  set upload_token = encode(gen_random_bytes(16), 'hex')
  where upload_token is null;

-- Lookup by token needs to be fast since the public endpoint queries by it.
create index if not exists dd_team_members_upload_token_idx
  on public.dd_team_members(upload_token)
  where upload_token is not null;

comment on column public.dd_team_members.upload_token is
  'Per-row token used by the public /card/[slug]/upload?t= self-service photo flow. Regeneratable from /admin/team to revoke an old link.';
