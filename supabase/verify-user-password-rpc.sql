-- Server-side password verification used by /api/auth/app-login.
--
-- Background: Supabase Auth's signInWithPassword is gated by captcha
-- middleware on the GoTrue side, even when called server-side with the
-- service role key. That broke native app login (apps can't produce a
-- Turnstile token). This RPC lets the API verify the bcrypt hash directly,
-- then issue a session via admin.generateLink — both of which are
-- captcha-free.
--
-- Security: SECURITY DEFINER + execute granted only to service_role so the
-- function is unreachable from anon/authenticated/PostgREST clients. Search
-- path is locked down to prevent search-path attacks; auth/extensions are
-- referenced fully qualified.

create or replace function public.verify_user_password(
  p_email text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = lower(p_email)
     and encrypted_password = extensions.crypt(p_password, encrypted_password)
     and (banned_until is null or banned_until < now())
     and email_confirmed_at is not null;

  return v_user_id;
end;
$$;

revoke all on function public.verify_user_password(text, text) from public;
revoke all on function public.verify_user_password(text, text) from anon;
revoke all on function public.verify_user_password(text, text) from authenticated;
grant execute on function public.verify_user_password(text, text) to service_role;
